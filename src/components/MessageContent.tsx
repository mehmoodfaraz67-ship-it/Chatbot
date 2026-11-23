import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ReactNode } from "react";

interface MessageContentProps {
  text: string;
}

function renderInlineFormatting(line: string, keyPrefix: string): ReactNode[] {
  const tokens = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      return (
        <code
          key={key}
          className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.875em] text-zinc-900"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      return (
        <strong key={key} className="font-semibold text-zinc-950">
          {token.slice(2, -2)}
        </strong>
      );
    }
    return <span key={key}>{token}</span>;
  });
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
        <span className="font-mono">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Copy code block"
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
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TextSegment({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = (endIndex: number) => {
    if (listItems.length === 0) return;
    const ListTag = listOrdered ? "ol" : "ul";
    elements.push(
      <ListTag
        key={`${keyPrefix}-list-${endIndex}`}
        className={`my-2 space-y-1 pl-5 ${
          listOrdered ? "list-decimal" : "list-disc"
        }`}
      >
        {listItems.map((item, idx) => (
          <li key={`${keyPrefix}-li-${endIndex}-${idx}`} className="leading-relaxed">
            {renderInlineFormatting(item, `${keyPrefix}-li-${endIndex}-${idx}`)}
          </li>
        ))}
      </ListTag>
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);

    if (bulletMatch) {
      if (listItems.length > 0 && listOrdered) flushList(idx);
      listOrdered = false;
      listItems.push(bulletMatch[1]);
      return;
    }

    if (orderedMatch) {
      if (listItems.length > 0 && !listOrdered) flushList(idx);
      listOrdered = true;
      listItems.push(orderedMatch[1]);
      return;
    }

    flushList(idx);

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingClass =
        level === 1
          ? "mt-3 mb-1.5 text-base font-semibold text-zinc-950"
          : level === 2
          ? "mt-2.5 mb-1 text-[15px] font-semibold text-zinc-950"
          : "mt-2 mb-1 text-sm font-semibold text-zinc-900";
      elements.push(
        <p key={`${keyPrefix}-h-${idx}`} className={headingClass}>
          {renderInlineFormatting(headingMatch[2], `${keyPrefix}-h-${idx}`)}
        </p>
      );
      return;
    }

    if (line.trim() === "") {
      elements.push(<div key={`${keyPrefix}-sp-${idx}`} className="h-2" />);
      return;
    }

    elements.push(
      <p key={`${keyPrefix}-p-${idx}`} className="leading-relaxed">
        {renderInlineFormatting(line, `${keyPrefix}-p-${idx}`)}
      </p>
    );
  });

  flushList(lines.length);

  return <div className="space-y-0.5 text-[15px]">{elements}</div>;
}

export function MessageContent({ text }: MessageContentProps) {
  const parts: Array<{ type: "text" | "code"; content: string; lang?: string }> =
    [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: "code",
      lang: match[1] || "",
      content: match[2].replace(/\n$/, ""),
    });
    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  if (parts.length === 0) {
    return <p className="text-[15px] leading-relaxed">{text}</p>;
  }

  return (
    <div className="min-w-0 break-words">
      {parts.map((part, idx) =>
        part.type === "code" ? (
          <CodeBlock
            key={`code-${idx}`}
            code={part.content}
            language={part.lang ?? ""}
          />
        ) : (
          <TextSegment
            key={`text-${idx}`}
            text={part.content}
            keyPrefix={`seg-${idx}`}
          />
        )
      )}
    </div>
  );
}
