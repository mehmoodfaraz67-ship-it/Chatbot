import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Copy, RotateCcw } from "lucide-react";
import type { Message } from "../types/chat";
import { formatTimestamp } from "../utils/format";
import { MessageContent } from "./MessageContent";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onDismissError: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      aria-label="Copy message"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function MessageList({
  messages,
  isLoading,
  error,
  onRetry,
  onDismissError,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isLoading ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, isLoading, error]);

  if (messages.length === 0 && !isLoading && !error) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
            How can I help today?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Ask a question, draft text, or debug code. Conversations are saved
            automatically in your browser.
          </p>
        </div>
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];
  const showWaitingIndicator =
    isLoading && (!lastMessage || lastMessage.role === "user" || lastMessage.text === "");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-3 text-[15px] leading-relaxed text-white sm:max-w-[75%]">
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>
                <span className="mt-1.5 px-1 text-xs text-zinc-400 tabular-nums">
                  {formatTimestamp(msg.createdAt)}
                </span>
              </div>
            );
          }

          if (msg.text === "" && isLoading) {
            return null;
          }

          return (
            <div key={msg.id} className="group flex flex-col items-start">
              <div className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-zinc-900 sm:px-5 sm:py-4">
                <MessageContent text={msg.text} />
              </div>
              <div className="mt-1.5 flex items-center gap-2 px-1">
                <span className="text-xs text-zinc-400 tabular-nums">
                  {formatTimestamp(msg.createdAt)}
                </span>
                {msg.text && !isLoading && <CopyButton text={msg.text} />}
              </div>
            </div>
          );
        })}

        {showWaitingIndicator && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start"
          >
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-sm text-zinc-500">
              Generating response...
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-600 px-3 text-xs font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={onDismissError}
                className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 whitespace-nowrap"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-px" />
      </div>
    </div>
  );
}
