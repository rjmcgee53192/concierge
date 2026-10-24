// Shared benchmark definitions: the fixed prompt set, the verified-pricing
// table, and the shape of the results file the harness writes and the
// /benchmark page renders. One source of truth — scripts/benchmark.mjs reads
// the same JSON files in data/ instead of keeping its own copies.

import promptsJson from "../data/qualification-prompts.json";
import pricingJson from "../data/verified-pricing.json";

export interface QualificationPrompt {
  id: string;
  leadName: string;
  prompt: string;
}

/** The fixed qualification prompt set. Every provider runs exactly these. */
export const QUALIFICATION_PROMPTS: QualificationPrompt[] = promptsJson.prompts;

export interface VerifiedModelPricing {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  source: string;
  sourceUrl: string;
  checkedAt: string;
}

/**
 * Published prices verified against the named source in each entry.
 * A model that is not listed here has NO verified price wired in, and the
 * harness must report its cost as null — never estimate one.
 */
export const VERIFIED_PRICING: Record<string, VerifiedModelPricing> = pricingJson.models;

export interface BenchmarkProviderResult {
  provider: string;
  model: string;
  endpoint?: string;
  status: "ok" | "error" | "not_configured";
  note?: string;
  /** Successful calls only — failures are counted separately. */
  calls: number;
  failures: number;
  meanLatencyMs: number | null;
  p95LatencyMs: number | null;
  /** Mean of per-call completion_tokens / wall-clock seconds, when usage was returned. */
  tokensPerSecond: number | null;
  totalPromptTokens: number | null;
  totalCompletionTokens: number | null;
  /**
   * Mean measured cost of one prompt-set call. Each prompt in the set is one
   * lead conversation, so this is the cost of qualifying one lead.
   * Null unless the model has a verified published price (VERIFIED_PRICING).
   */
  costPerLeadUsd: number | null;
  costNote: string;
  pricingSource?: string;
}

export interface BenchmarkResultsFile {
  generatedAt: string;
  promptSet: { file: string; count: number };
  results: BenchmarkProviderResult[];
}

/** A result counts as measured only if real calls succeeded. */
export function isMeasured(r: BenchmarkProviderResult): boolean {
  return r.status === "ok" && r.calls > 0 && r.meanLatencyMs !== null;
}
