import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_MODEL = "gemini-4-hydrogen";
const MAX_CONTEXT_MESSAGES = 16;

interface ChatMessageInput {
  role: "user" | "model";
  text: string;
}

let cachedClient: { apiKey: string; client: GoogleGenAI } | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Please add GEMINI_API_KEY in Settings > Secrets."
    );
  }
  if (cachedClient && cachedClient.apiKey === apiKey) {
    return cachedClient.client;
  }
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  cachedClient = { apiKey, client };
  return client;
}

function extractReadableErrorMessage(raw: string): string {
  let current = raw.trim();
  for (let i = 0; i < 3; i++) {
    if (!current.startsWith("{")) break;
    try {
      const parsed = JSON.parse(current) as Record<string, unknown>;
      if (parsed.error && typeof parsed.error === "object") {
        const inner = parsed.error as Record<string, unknown>;
        if (typeof inner.message === "string") {
          current = inner.message.trim();
          continue;
        }
      }
      if (typeof parsed.message === "string") {
        current = parsed.message.trim();
        continue;
      }
    } catch {
      break;
    }
    break;
  }
  return current;
}

function parseGeminiError(err: unknown): {
  status: number;
  message: string;
  shouldFallback: boolean;
} {
  const rawMessage =
    err instanceof Error ? err.message : "An unexpected error occurred.";
  const readable = extractReadableErrorMessage(rawMessage);

  if (
    rawMessage.includes("API_KEY_INVALID") ||
    rawMessage.includes("PERMISSION_DENIED") ||
    rawMessage.includes("GEMINI_API_KEY is not configured")
  ) {
    return {
      status: 403,
      message:
        "Invalid or missing Gemini API key. Please check your key in Settings > Secrets.",
      shouldFallback: false,
    };
  }

  if (rawMessage.includes("RESOURCE_EXHAUSTED") || rawMessage.includes("429")) {
    return {
      status: 429,
      message:
        "Rate limit or quota exceeded. Please wait a moment and try again.",
      shouldFallback: false,
    };
  }

  if (
    rawMessage.includes("UNAVAILABLE") ||
    rawMessage.includes("503") ||
    rawMessage.includes("high demand") ||
    rawMessage.includes("fetch failed") ||
    rawMessage.includes("ECONNRESET") ||
    rawMessage.includes("ETIMEDOUT") ||
    rawMessage.includes("socket")
  ) {
    return {
      status: 503,
      message:
        "Gemini is temporarily busy. Please try again in a moment.",
      shouldFallback: true,
    };
  }

  if (rawMessage.includes("NOT_FOUND") || rawMessage.includes("404")) {
    return {
      status: 404,
      message: "Requested Gemini model is unavailable.",
      shouldFallback: true,
    };
  }

  return {
    status: 500,
    message: readable || "Failed to generate a response from Gemini.",
    shouldFallback:
      rawMessage.includes("500") || rawMessage.includes("INTERNAL"),
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post("/api/chat", async (req: Request, res: Response) => {
    const body = req.body as { messages?: unknown };

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(400).json({ error: "A non-empty messages array is required." });
      return;
    }

    const sanitizedMessages: ChatMessageInput[] = body.messages
      .filter((item): item is ChatMessageInput => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        return (
          (candidate.role === "user" || candidate.role === "model") &&
          typeof candidate.text === "string" &&
          candidate.text.trim().length > 0
        );
      })
      .map((item) => ({
        role: item.role,
        text: item.text.trim(),
      }));

    if (
      sanitizedMessages.length === 0 ||
      sanitizedMessages[sanitizedMessages.length - 1].role !== "user"
    ) {
      res.status(400).json({
        error: "Conversation must end with a non-empty user message.",
      });
      return;
    }

    let clientAborted = false;
    let activeAbortController: AbortController | null = null;

    res.on("close", () => {
      if (!res.writableEnded) {
        clientAborted = true;
        activeAbortController?.abort();
      }
    });

    req.socket?.setNoDelay?.(true);

    try {
      const ai = getGeminiClient();

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
      res.write(": open\n\n");

      const recentMessages = sanitizedMessages.slice(-MAX_CONTEXT_MESSAGES);
      const contents = recentMessages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      }));

      const systemInstruction =
        "You are a fast, helpful, and concise AI assistant. Give direct, clear answers without unnecessary filler.";

      const attempts = [
        {
          model: PRIMARY_MODEL,
          thinkingLevel: ThinkingLevel.MINIMAL,
          firstTokenTimeoutMs: 8000,
        },
        {
          model: PRIMARY_MODEL,
          thinkingLevel: ThinkingLevel.MINIMAL,
          firstTokenTimeoutMs: 10000,
        },
        {
          model: FALLBACK_MODEL,
          thinkingLevel: ThinkingLevel.LOW,
          firstTokenTimeoutMs: 12000,
        },
      ];

      let lastError: unknown = null;
      let completed = false;

      for (let i = 0; i < attempts.length; i++) {
        if (clientAborted) return;
        const attempt = attempts[i];
        const controller = new AbortController();
        activeAbortController = controller;

        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, attempt.firstTokenTimeoutMs);

        try {
          const stream = await ai.models.generateContentStream({
            model: attempt.model,
            contents,
            config: {
              abortSignal: controller.signal,
              thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
              systemInstruction,
            },
          });

          const iterator = stream[Symbol.asyncIterator]();
          let firstText = "";

          while (true) {
            const step = await iterator.next();
            if (step.done) break;
            const text = step.value.text ?? "";
            if (text) {
              firstText = text;
              break;
            }
          }

          clearTimeout(timer);

          if (!firstText) {
            throw new Error("Model returned an empty response.");
          }

          if (clientAborted) return;

          res.write(`data: ${JSON.stringify({ text: firstText })}\n\n`);

          while (true) {
            if (clientAborted) break;
            const step = await iterator.next();
            if (step.done) break;
            const text = step.value.text ?? "";
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          }

          if (!clientAborted) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
          }

          completed = true;
          break;
        } catch (err) {
          clearTimeout(timer);
          if (clientAborted) return;

          if (timedOut) {
            lastError = new Error(
              "Gemini took too long to respond. Please try again."
            );
            if (i < attempts.length - 1) continue;
            throw lastError;
          }

          lastError = err;
          const parsed = parseGeminiError(err);
          if (!parsed.shouldFallback || i === attempts.length - 1) {
            throw err;
          }
          if (
            i === 0 &&
            attempts[1]?.model === PRIMARY_MODEL &&
            (parsed.status === 503 || parsed.status === 404)
          ) {
            i = 1;
          }
        } finally {
          if (activeAbortController === controller) {
            activeAbortController = null;
          }
        }
      }

      if (!completed && !clientAborted) {
        throw lastError ?? new Error("Failed to generate a response from Gemini.");
      }
    } catch (err) {
      const { status, message } = parseGeminiError(err);
      if (!res.headersSent) {
        res.status(status).json({ error: message });
      } else if (!clientAborted) {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
