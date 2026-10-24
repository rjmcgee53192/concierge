// Model access sits behind one interface so the hackathon adapters are
// config swaps, not rewrites. Stub is the default until a real provider is
// configured via env — and a provider without its key refuses to run rather
// than faking a completion.

export interface ModelProvider {
  name: string;
  /** One-shot completion. Agents build the prompt; providers just run it. */
  complete(prompt: string): Promise<string>;
}

export interface CompletionUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface CompletionResult {
  text: string;
  /** Model ID the API reported for the call (falls back to the requested ID). */
  model: string;
  usage: CompletionUsage;
}

/** A provider that can report token usage — the benchmark harness needs it. */
export interface MeteredModelProvider extends ModelProvider {
  completeWithUsage(prompt: string): Promise<CompletionResult>;
}

export class StubModelProvider implements ModelProvider {
  name = "stub";
  async complete(prompt: string): Promise<string> {
    // Deliberately boring: echo a trimmed prompt so flows can be wired and
    // tested end-to-end with zero keys, zero cost, zero fake "AI" output.
    return `[stub model] ${prompt.slice(0, 120)}`;
  }
}

export class MuseModelProvider implements ModelProvider {
  name = "muse-spark";
  async complete(): Promise<string> {
    // Real Muse Spark wiring lands Oct 26 IF Meta accepts the hackathon
    // application and issues the $150 Model API credits. No key, no call —
    // throwing here is honest; silently faking a response would not be.
    throw new Error("MuseModelProvider not wired yet — pending Meta hackathon API access (Oct 26).");
  }
}

// --- Nebius Token Factory (Nebius × NVIDIA adapter) -------------------------
// Verified against Nebius's own docs on 2026-10-24:
//   - Base URL: https://api.tokenfactory.nebius.com/v1/ (docs.tokenfactory.nebius.com)
//   - OpenAI-compatible: POST /v1/chat/completions, "Authorization: Bearer <key>"
//   - Responses carry usage { prompt_tokens, completion_tokens, total_tokens }
// Nemotron model IDs Token Factory serves include
// "nvidia/nemotron-3-super-120b-a12b" (Nemotron 3 Super, text) and
// "nvidia/Nemotron-3.5-Super-VL" (vision-language). The default below is the
// text model; override with NEBIUS_MODEL.
//
// SERVER-SIDE ONLY: this provider reads NEBIUS_API_KEY from the environment
// and sends it as a bearer token. Never import it into a client component.

export const NEBIUS_DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1";
export const NEBIUS_DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b";

export class NebiusProvider implements MeteredModelProvider {
  name = "nebius-token-factory";
  readonly model: string;
  readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(opts?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.NEBIUS_API_KEY;
    this.model = opts?.model ?? process.env.NEBIUS_MODEL ?? NEBIUS_DEFAULT_MODEL;
    this.baseUrl = (opts?.baseUrl ?? process.env.NEBIUS_BASE_URL ?? NEBIUS_DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  /** True when a key is present. Absent key = not configured, never faked. */
  get configured(): boolean {
    return !!this.apiKey;
  }

  async complete(prompt: string): Promise<string> {
    return (await this.completeWithUsage(prompt)).text;
  }

  async completeWithUsage(prompt: string): Promise<CompletionResult> {
    if (!this.apiKey) {
      throw new Error(
        "NebiusProvider is not configured: NEBIUS_API_KEY is not set. " +
          "Create a key in Nebius Token Factory (https://tokenfactory.nebius.com/) and set NEBIUS_API_KEY — " +
          "see the Nebius section of the README. No request was made."
      );
    }
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 1024,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Nebius Token Factory request failed: HTTP ${res.status}${body ? ` — ${body.slice(0, 300)}` : ""}`
      );
    }
    const json = await res.json();
    const text: unknown = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new Error("Nebius Token Factory response had no choices[0].message.content — nothing to return.");
    }
    const u = json?.usage;
    return {
      text,
      model: typeof json?.model === "string" ? json.model : this.model,
      usage: {
        promptTokens: typeof u?.prompt_tokens === "number" ? u.prompt_tokens : null,
        completionTokens: typeof u?.completion_tokens === "number" ? u.completion_tokens : null,
        totalTokens: typeof u?.total_tokens === "number" ? u.total_tokens : null,
      },
    };
  }
}

export function getModelProvider(): ModelProvider {
  // A configured Nebius key wins; otherwise the honest stub. Selection is by
  // env presence only — the provider itself still refuses to run keyless.
  if (process.env.NEBIUS_API_KEY) return new NebiusProvider();
  return new StubModelProvider();
}
