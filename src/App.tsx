import { useCallback, useEffect, useRef, useState } from "react";
import { ChatHeader } from "./components/ChatHeader";
import { ChatInput } from "./components/ChatInput";
import { MessageList } from "./components/MessageList";
import { Sidebar } from "./components/Sidebar";
import type { Conversation, Message } from "./types/chat";
import {
  createConversation,
  deriveTitleFromMessage,
  generateId,
  loadActiveConversationId,
  loadConversations,
  saveActiveConversationId,
  saveConversations,
} from "./utils/storage";

interface StreamChunkPayload {
  text?: string;
  done?: boolean;
  error?: string;
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations()
  );

  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = loadConversations();
    if (saved.length === 0) return null;
    const savedActiveId = loadActiveConversationId();
    if (savedActiveId && saved.some((c) => c.id === savedActiveId)) {
      return savedActiveId;
    }
    return saved[0].id;
  });

  const resolvedActiveId =
    activeId && conversations.some((c) => c.id === activeId)
      ? activeId
      : conversations[0]?.id ?? null;

  const activeConversation =
    conversations.find((c) => c.id === resolvedActiveId) ?? null;

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    if (!isLoading) {
      saveConversations(conversations);
    }
  }, [conversations, isLoading]);

  useEffect(() => {
    saveActiveConversationId(resolvedActiveId);
  }, [resolvedActiveId]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const abortActiveRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isSendingRef.current = false;
    setIsLoading(false);
  }, []);

  const handleCreateConversation = useCallback(() => {
    abortActiveRequest();
    setError(null);
    const next = createConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveId(next.id);
  }, [abortActiveRequest]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      if (id === resolvedActiveId) return;
      abortActiveRequest();
      setError(null);
      setActiveId(id);
    },
    [abortActiveRequest, resolvedActiveId]
  );

  const handleRenameConversation = useCallback((id: string, title: string) => {
    const cleaned = title.trim();
    if (!cleaned) return;
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id
          ? { ...conv, title: cleaned, updatedAt: Date.now() }
          : conv
      )
    );
  }, []);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      if (id === resolvedActiveId) {
        abortActiveRequest();
        setError(null);
      }

      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (id === resolvedActiveId) {
          setActiveId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
    },
    [abortActiveRequest, resolvedActiveId]
  );

  const streamGeminiReply = useCallback(
    async (conversationId: string, historyForApi: Message[]) => {
      abortActiveRequest();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      isSendingRef.current = true;
      setIsLoading(true);
      setError(null);

      const assistantMessageId = generateId();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "model",
        text: "",
        createdAt: Date.now(),
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                messages: [...conv.messages, assistantMessage],
                updatedAt: Date.now(),
              }
            : conv
        )
      );

      let receivedAnyText = false;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: historyForApi.map((m) => ({
              role: m.role,
              text: m.text,
            })),
          }),
        });

        if (!response.ok) {
          let errMsg = `Request failed (${response.status}).`;
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) errMsg = payload.error;
          } catch {
            // Keep generic status message
          }
          throw new Error(errMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Streaming response is unavailable.");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        const processSseLine = (rawLine: string) => {
          const trimmed = rawLine.trim();
          if (!trimmed.startsWith("data:")) return;
          const jsonText = trimmed.slice(5).trim();
          if (!jsonText) return;

          let payload: StreamChunkPayload;
          try {
            payload = JSON.parse(jsonText) as StreamChunkPayload;
          } catch {
            return;
          }

          if (payload.error) {
            throw new Error(payload.error);
          }

          if (payload.text) {
            receivedAnyText = true;
            const chunkText = payload.text;
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id !== conversationId) return conv;
                return {
                  ...conv,
                  updatedAt: Date.now(),
                  messages: conv.messages.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, text: m.text + chunkText }
                      : m
                  ),
                };
              })
            );
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            processSseLine(line);
          }
        }

        if (buffer.trim()) {
          processSseLine(buffer);
        }

        if (!receivedAnyText) {
          throw new Error("Gemini returned an empty response. Please try again.");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          if (!receivedAnyText) {
            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === conversationId
                  ? {
                      ...conv,
                      messages: conv.messages.filter(
                        (m) => m.id !== assistantMessageId
                      ),
                    }
                  : conv
              )
            );
          }
          return;
        }

        if (!receivedAnyText) {
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversationId
                ? {
                    ...conv,
                    messages: conv.messages.filter(
                      (m) => m.id !== assistantMessageId
                    ),
                  }
                : conv
            )
          );
        }

        const message =
          err instanceof Error
            ? err.message
            : "Unable to reach Gemini. Please try again.";
        setError(message);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          isSendingRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [abortActiveRequest]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || isSendingRef.current) return;
    isSendingRef.current = true;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      text: trimmed,
      createdAt: Date.now(),
    };

    setInput("");

    let targetId = resolvedActiveId;
    let nextMessages: Message[] = [];

    if (!targetId || !activeConversation) {
      const created = createConversation(deriveTitleFromMessage(trimmed));
      created.messages = [userMessage];
      targetId = created.id;
      nextMessages = created.messages;
      setConversations((prev) => [created, ...prev]);
      setActiveId(created.id);
    } else {
      const shouldAutoTitle =
        activeConversation.messages.length === 0 &&
        activeConversation.title === "New Chat";
      nextMessages = [...activeConversation.messages, userMessage];

      setConversations((prev) => {
        const updated = prev.map((conv) =>
          conv.id === targetId
            ? {
                ...conv,
                title: shouldAutoTitle
                  ? deriveTitleFromMessage(trimmed)
                  : conv.title,
                messages: nextMessages,
                updatedAt: Date.now(),
              }
            : conv
        );
        return [...updated].sort((a, b) => b.updatedAt - a.updatedAt);
      });
    }

    void streamGeminiReply(targetId, nextMessages);
  }, [
    activeConversation,
    input,
    isLoading,
    resolvedActiveId,
    streamGeminiReply,
  ]);

  const handleRetry = useCallback(() => {
    if (!activeConversation || isLoading || isSendingRef.current) return;
    isSendingRef.current = true;
    const msgs = activeConversation.messages;
    if (msgs.length === 0) {
      isSendingRef.current = false;
      return;
    }

    const lastUserIndex = [...msgs]
      .reverse()
      .findIndex((m) => m.role === "user");
    if (lastUserIndex === -1) return;

    const cutoff = msgs.length - lastUserIndex;
    const historyUpToUser = msgs.slice(0, cutoff);

    if (historyUpToUser.length !== msgs.length) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversation.id
            ? { ...conv, messages: historyUpToUser, updatedAt: Date.now() }
            : conv
        )
      );
    }

    void streamGeminiReply(activeConversation.id, historyUpToUser);
  }, [activeConversation, isLoading, streamGeminiReply]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-zinc-50 text-zinc-900">
      <Sidebar
        conversations={conversations}
        activeId={resolvedActiveId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelect={handleSelectConversation}
        onCreate={handleCreateConversation}
        onRename={handleRenameConversation}
        onDelete={handleDeleteConversation}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-zinc-50">
        <ChatHeader
          conversation={activeConversation}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onCreateConversation={handleCreateConversation}
          onRenameConversation={handleRenameConversation}
        />

        <MessageList
          messages={activeConversation?.messages ?? []}
          isLoading={isLoading}
          error={error}
          onRetry={handleRetry}
          onDismissError={() => setError(null)}
        />

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={abortActiveRequest}
          isLoading={isLoading}
        />
      </main>
    </div>
  );
}
