import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";

/*
  Provider-agnostic AI layer for the RENET assistant.
  Each provider exposes complete({ system, messages }) → { text, truncated }
  and throws AiError with a `kind` the HTTP layer maps to a safe message:
    auth | rate_limit | timeout | unavailable | bad_request
  API keys are read from the server environment only.
*/
export class AiError extends Error {
  constructor(kind, message, { retryAfter } = {}) {
    super(message);
    this.kind = kind;
    this.retryAfter = retryAfter;
  }
}

const SHORT_RATE_LIMIT_WAIT_S = 12;

// Parses Groq reset durations such as "45.33s", "14m24s", "1h2m3s" or "250ms".
export function parseDurationSeconds(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  let total = 0;
  let matched = false;
  for (const [, amount, unit] of text.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)) {
    matched = true;
    total += Number(amount) * { h: 3600, m: 60, s: 1, ms: 0.001 }[unit];
  }
  return matched ? total : null;
}

function retryAfterSeconds(error) {
  const headers = error?.headers;
  const raw = typeof headers?.get === "function" ? headers.get("retry-after") : headers?.["retry-after"];
  const seconds = Number.parseFloat(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function mapSdkError(error, Sdk) {
  if (error instanceof AiError) return error;
  if (error instanceof Sdk.AuthenticationError || error instanceof Sdk.PermissionDeniedError) {
    return new AiError("auth", "Provider rejected the API key.");
  }
  if (error instanceof Sdk.RateLimitError) {
    return new AiError("rate_limit", "Provider rate limit reached.", { retryAfter: retryAfterSeconds(error) });
  }
  if (error instanceof Sdk.APIConnectionTimeoutError) return new AiError("timeout", "Provider timed out.");
  if (error instanceof Sdk.BadRequestError || error instanceof Sdk.NotFoundError) {
    return new AiError("bad_request", `Provider rejected the request (${error.status}).`);
  }
  if (error instanceof Sdk.APIError) return new AiError("unavailable", `Provider error ${error.status ?? "connection"}.`);
  return new AiError("unavailable", "Unexpected provider failure.");
}

export function createGroqProvider({ apiKey, model, maxOutputTokens = 1024, timeoutMs = 25_000 }) {
  // Retries are handled below so a long rate-limit wait never stalls a visitor.
  const client = new Groq({ apiKey, timeout: timeoutMs, maxRetries: 0 });
  // gpt-oss and qwen3 are reasoning models: keep reasoning short and out of the reply.
  const reasoning = model.startsWith("openai/gpt-oss")
    ? { reasoning_effort: "low", include_reasoning: false }
    : model.startsWith("qwen/")
      ? { reasoning_format: "hidden" }
      : {};

  return {
    name: "groq",
    model,
    async complete({ system, messages }) {
      const request = () =>
        client.chat.completions
          .create({
            model,
            messages: [{ role: "system", content: system }, ...messages],
            max_completion_tokens: maxOutputTokens,
            temperature: 0.3,
            ...reasoning,
          })
          .withResponse();
      let completion;
      let response;
      try {
        ({ data: completion, response } = await request());
      } catch (first) {
        const mapped = mapSdkError(first, Groq);
        // Short rate-limit pause: wait once and retry so the visitor still gets an answer.
        if (mapped.kind === "rate_limit" && mapped.retryAfter !== null && mapped.retryAfter <= SHORT_RATE_LIMIT_WAIT_S) {
          await new Promise((resolve) => setTimeout(resolve, Math.ceil(mapped.retryAfter * 1000) + 250));
          try {
            ({ data: completion, response } = await request());
          } catch (second) {
            throw mapSdkError(second, Groq);
          }
        } else {
          throw mapped;
        }
      }
      const choice = completion.choices?.[0];
      const remaining = Number.parseInt(response.headers.get("x-ratelimit-remaining-tokens"), 10);
      return {
        text: (choice?.message?.content || "").trim(),
        truncated: choice?.finish_reason === "length",
        rateLimit: {
          remainingTokens: Number.isFinite(remaining) ? remaining : null,
          resetTokensSeconds: parseDurationSeconds(response.headers.get("x-ratelimit-reset-tokens")),
        },
      };
    },
  };
}

export function createAnthropicProvider({ apiKey, model, maxOutputTokens = 1024 }) {
  const client = new Anthropic({ apiKey });
  return {
    name: "anthropic",
    model,
    async complete({ system, messages }) {
      try {
        const response = await client.beta.messages.create({
          model,
          max_tokens: maxOutputTokens,
          output_config: { effort: "low" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages,
        });
        if (response.stop_reason === "refusal") return { text: "", refused: true };
        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();
        return { text, truncated: response.stop_reason === "max_tokens" };
      } catch (error) {
        throw mapSdkError(error, Anthropic);
      }
    },
  };
}

/*
  Picks the provider from the environment:
  AI_PROVIDER=groq|anthropic, otherwise Groq when GROQ_API_KEY is set,
  otherwise Anthropic when ANTHROPIC_API_KEY is set, otherwise none.
*/
export function createProviderFromEnv(env) {
  const choice = (env.AI_PROVIDER || (env.GROQ_API_KEY ? "groq" : env.ANTHROPIC_API_KEY ? "anthropic" : "")).toLowerCase();
  const maxOutputTokens = Number(env.AI_MAX_OUTPUT_TOKENS) > 0 ? Number(env.AI_MAX_OUTPUT_TOKENS) : 1024;
  if (choice === "groq" && env.GROQ_API_KEY) {
    return createGroqProvider({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL || "openai/gpt-oss-120b", maxOutputTokens });
  }
  if (choice === "anthropic" && env.ANTHROPIC_API_KEY) {
    return createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || "claude-opus-5-5", maxOutputTokens });
  }
  return null;
}

/* ---------- Output safety ---------- */

// Figures RENET has not published. A reply containing any of these is not shown.
const UNVERIFIED_FIGURE_PATTERNS = [
  /(₹|\brs\.?|\binr)\s?\d/i, // prices
  /\b\d+(?:[.,]\d+)?\s?(kwh|wh|ah|mah|kw|watts?|volts?|v)\b/i, // battery / motor
  /\b\d+(?:\.\d+)?\s?(km\/h|kmph|kph|mph)\b/i, // speed
  /\b\d+(?:\s?[-–]\s?\d+)?\s?(hours?|hrs?|minutes?|mins?)\b/i, // charging time
  /warrant[^.]{0,40}\b\d+\s?(years?|yrs?|months?|km)\b|\b\d+\s?(years?|yrs?|months?)\b[^.]{0,40}warrant/i,
  /\b(range|per charge|single charge)\b[^.]{0,30}\b\d+\s?(km|kilomet)/i,
  /\b\d+\s?(km|kilomet)\w*\b[^.]{0,30}\b(range|per charge|single charge)\b/i,
];

export function containsUnverifiedFigures(text) {
  return UNVERIFIED_FIGURE_PATTERNS.some((pattern) => pattern.test(text));
}

export const UNVERIFIED_FIGURE_REPLY =
  "I can't confirm figures like that — RENET hasn't published official prices, range, battery, charging, speed or warranty details yet. Please contact the RENET team on WhatsApp or at info@renet.in for confirmed information, or request a test ride or call-back using the form on the homepage.";

// The chat UI shows plain text, so strip common Markdown the model may add.
export function toPlainText(text) {
  return text
    // Models often write "D‑8" with a non-breaking hyphen; normalise so the site
    // (and visitors searching the text) see the real model name "D-8".
    .replace(/[\u2010\u2011\u2012]/g, "-")
    .replace(/\u00a0|\u202f/g, " ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
