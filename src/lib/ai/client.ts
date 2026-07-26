import "server-only";

import Anthropic from "@anthropic-ai/sdk";

// The AI office's employees are all backed by Claude. This is the single place
// the API is called from — server-only, never import into a Client Component.

export const AI_OFFICE_MODEL = process.env.AI_OFFICE_MODEL || "claude-opus-5";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가한 뒤 다시 시도하세요."
    );
    this.name = "MissingApiKeyError";
  }
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError();
  }
  return new Anthropic({ apiKey });
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Ask Claude for a structured JSON answer that conforms to `schema`.
 *
 * Uses structured outputs (`output_config.format`) so the response is
 * guaranteed to parse. Runs at a modest effort level — these are routine
 * back-office tasks, not deep reasoning — to keep latency and cost sane.
 */
export async function askForJson<T>(params: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const client = getClient();

  const response = await client.messages.create({
    model: AI_OFFICE_MODEL,
    max_tokens: params.maxTokens ?? 8192,
    system: params.system,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: params.schema },
    },
    messages: [{ role: "user", content: params.prompt }],
    // SDK typings may lag output_config.format / effort — cast to satisfy TS.
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") {
    throw new Error("AI가 안전상의 이유로 요청을 거부했습니다.");
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!text.trim()) {
    throw new Error("AI 응답이 비어 있습니다.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("AI 응답을 JSON으로 해석하지 못했습니다.");
  }
}
