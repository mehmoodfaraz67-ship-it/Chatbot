import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Check,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Conversation } from "../types/chat";
import { formatRelativeDate } from "../utils/format";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function Sidebar({
  conversations,
  activeId,
  isOpen,
  onClose,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (conv: Conversation) => {
    setConfirmDeleteId(null);
    setEditingId(conv.id);
    setDraftTitle(conv.title);
  };

  const commitRename = (id: string) => {
    const trimmed = draftTitle.trim();
    if (trimmed) {
      onRename(id, trimmed);
    }
    setEditingId(null);
    setDraftTitle("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftTitle("");
  };

  const handleEditKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    id: string
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-zinc-950/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Conversations"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform duration-150 ease-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4">
          <span className="text-base font-semibold tracking-tight text-zinc-950 whitespace-nowrap shrink-0">
            Gemini Chat
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              onCreate();
              onClose();
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>New Chat</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Chat history">
          {conversations.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-medium text-zinc-700">
                No conversations yet
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Start a new chat to begin.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === activeId;
                const isEditing = editingId === conv.id;
                const isConfirmingDelete = confirmDeleteId === conv.id;

                return (
                  <li key={conv.id}>
                    <div
                      className={`group relative flex items-center gap-1 rounded-lg px-2.5 py-2 transition-colors ${
                        isActive
                          ? "bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-200"
                          : "text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-950"
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex w-full items-center gap-1">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            onKeyDown={(e) => handleEditKeyDown(e, conv.id)}
                            maxLength={80}
                            aria-label="Conversation title"
                            className="h-8 min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-950 focus:border-blue-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => commitRename(conv.id)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            aria-label="Save title"
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            aria-label="Cancel rename"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      ) : isConfirmingDelete ? (
                        <div className="flex w-full items-center justify-between gap-2 py-0.5">
                          <span className="truncate text-xs font-medium text-red-700">
                            Delete this chat?
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDelete(conv.id);
                                setConfirmDeleteId(null);
                              }}
                              className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 whitespace-nowrap"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              onSelect(conv.id);
                              onClose();
                            }}
                            className="flex min-w-0 flex-1 items-start gap-2.5 text-left focus-visible:outline-none"
                          >
                            <MessageSquare
                              className={`mt-0.5 h-4 w-4 shrink-0 ${
                                isActive ? "text-zinc-900" : "text-zinc-400"
                              }`}
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium leading-snug">
                                {conv.title}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 tabular-nums">
                                <span>
                                  {conv.messages.length}{" "}
                                  {conv.messages.length === 1 ? "msg" : "msgs"}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{formatRelativeDate(conv.updatedAt)}</span>
                              </div>
                            </div>
                          </button>

                          <div
                            className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
                              isActive
                                ? "opacity-100"
                                : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => startEditing(conv)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                              aria-label={`Rename ${conv.title}`}
                              title="Rename conversation"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(conv.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                              aria-label={`Delete ${conv.title}`}
                              title="Delete conversation"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <div className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500 tabular-nums">
          <span>
            {conversations.length}{" "}
            {conversations.length === 1 ? "conversation" : "conversations"}
          </span>
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          <span>Saved locally</span>
        </div>
      </aside>
    </>
  );
}
