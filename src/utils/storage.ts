import type { Conversation, Message } from "../types/chat";

const CONVERSATIONS_STORAGE_KEY = "gemini_chat_conversations_v1";
const ACTIVE_ID_STORAGE_KEY = "gemini_chat_active_id_v1";

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createConversation(title = "New Chat"): Conversation {
  const now = Date.now();
  return {
    id: generateId(),
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function deriveTitleFromMessage(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "New Chat";
  const maxLen = 42;
  if (normalized.length <= maxLen) return normalized;
  const sliced = normalized.slice(0, maxLen);
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 18 ? sliced.slice(0, lastSpace) : sliced) + "...";
}

function isValidMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const msg = value as Record<string, unknown>;
  return (
    typeof msg.id === "string" &&
    (msg.role === "user" || msg.role === "model") &&
    typeof msg.text === "string" &&
    typeof msg.createdAt === "number"
  );
}

function isValidConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const conv = value as Record<string, unknown>;
  return (
    typeof conv.id === "string" &&
    typeof conv.title === "string" &&
    Array.isArray(conv.messages) &&
    conv.messages.every(isValidMessage) &&
    typeof conv.createdAt === "number" &&
    typeof conv.updatedAt === "number"
  );
}

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidConversation)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      JSON.stringify(conversations)
    );
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadActiveConversationId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveConversationId(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(ACTIVE_ID_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_ID_STORAGE_KEY, id);
    }
  } catch {
    // Ignore storage errors gracefully
  }
}
