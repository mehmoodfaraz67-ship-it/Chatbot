import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, Menu, Pencil, Plus, X } from "lucide-react";
import type { Conversation } from "../types/chat";

interface ChatHeaderProps {
  conversation: Conversation | null;
  onOpenSidebar: () => void;
  onCreateConversation: () => void;
  onRenameConversation: (id: string, title: string) => void;
}

export function ChatHeader({
  conversation,
  onOpenSidebar,
  onCreateConversation,
  onRenameConversation,
}: ChatHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsEditing(false);
  }, [conversation?.id]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = () => {
    if (!conversation) return;
    setDraftTitle(conversation.title);
    setIsEditing(true);
  };

  const commitRename = () => {
    if (!conversation) return;
    const trimmed = draftTitle.trim();
    if (trimmed) {
      onRenameConversation(conversation.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-3 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"
          aria-label="Open conversations menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        {conversation ? (
          isEditing ? (
            <div className="flex min-w-0 max-w-md flex-1 items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={80}
                aria-label="Edit conversation title"
                className="h-9 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-950 focus:border-blue-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={commitRename}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label="Save title"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label="Cancel rename"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-sm font-semibold text-zinc-950 sm:text-base">
                {conversation.title}
              </h1>
              <button
                type="button"
                onClick={startEditing}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label="Rename current conversation"
                title="Rename conversation"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )
        ) : (
          <h1 className="truncate text-sm font-semibold text-zinc-950 sm:text-base">
            New Chat
          </h1>
        )}
      </div>

      <button
        type="button"
        onClick={onCreateConversation}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap lg:hidden"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>New Chat</span>
      </button>
    </header>
  );
}
