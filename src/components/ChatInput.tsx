import { useEffect, useRef } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSend();
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) {
      onStop();
      return;
    }
    if (value.trim()) {
      onSend();
    }
  };

  const canSend = value.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-zinc-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-xl border border-zinc-300 bg-white p-2 transition-colors focus-within:border-zinc-900"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Gemini..."
          aria-label="Message input"
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-normal text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
        />

        {isLoading ? (
          <button
            type="submit"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="Stop generating"
            title="Stop generating"
          >
            <Square className="h-4 w-4 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
            aria-label="Send message"
            title="Send message"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </form>
      <p className="mx-auto mt-2 hidden max-w-3xl text-center text-xs text-zinc-400 sm:block">
        Press Enter to send · Shift + Enter for a new line
      </p>
    </div>
  );
}
