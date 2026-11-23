export type MessageRole = "user" | "model";

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
