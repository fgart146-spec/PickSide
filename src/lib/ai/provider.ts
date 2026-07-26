import "server-only";

import type { AiWorker } from "@/lib/ai/constants";

// AiProvider — the swappable execution backend for the AI office.
//
// The admin pages, approval flow, job log, and DB schema never change; only the
// provider does. Today we run `ManualClaudeCodeProvider` (Claude Code reads the
// data and writes result JSON, which an admin imports). Later, dropping in
// `ClaudeApiProvider` / `OpenAiProvider` / `LocalModelProvider` lets the same
// requests be fulfilled automatically — see generate().

export type ProviderMode = "manual" | "api";

export interface AiProvider {
  readonly id: string;
  readonly label: string;
  readonly mode: ProviderMode;
  // API providers turn a request spec into a raw result payload. Manual
  // providers throw — results arrive out-of-band via admin import instead.
  generate(worker: AiWorker, request: unknown): Promise<unknown>;
}

// Current provider: no model call happens here. The server only produces the
// request spec; Claude Code (run separately) fulfills it and the admin imports
// the JSON. Nothing runs automatically without Claude Code.
export class ManualClaudeCodeProvider implements AiProvider {
  readonly id = "manual_claude_code";
  readonly label = "Claude Code (수동)";
  readonly mode: ProviderMode = "manual";

  async generate(): Promise<unknown> {
    throw new Error(
      "수동(Claude Code) 제공자는 서버에서 직접 생성하지 않습니다. 작업 요청을 만든 뒤 결과 JSON을 업로드하세요."
    );
  }
}

// Placeholder for a future automated backend. Wired to the existing Anthropic
// client (src/lib/ai/client.ts) but intentionally NOT the default — the current
// operating model forbids calling the Claude API from the app.
export class ClaudeApiProvider implements AiProvider {
  readonly id = "claude_api";
  readonly label = "Claude API (자동)";
  readonly mode: ProviderMode = "api";

  async generate(): Promise<unknown> {
    // Left unimplemented on purpose. To enable automatic runs later, implement
    // per-worker prompts here (or delegate to the workers' buildRequest output)
    // and set AI_PROVIDER=claude_api. The rest of the office is unchanged.
    throw new Error("ClaudeApiProvider는 아직 활성화되지 않았습니다.");
  }
}

let cached: AiProvider | null = null;

export function getProvider(): AiProvider {
  if (cached) return cached;
  const id = process.env.AI_PROVIDER ?? "manual_claude_code";
  cached = id === "claude_api" ? new ClaudeApiProvider() : new ManualClaudeCodeProvider();
  return cached;
}
