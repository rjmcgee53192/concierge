#!/usr/bin/env node
// Concierge benchmark harness — the Nebius × NVIDIA entry is "same brain,
// measured", so this script produces real numbers or none at all.
//
// What it does:
//   - Runs the fixed qualification prompt set (data/qualification-prompts.json)
//     through each CONFIGURED provider, sequentially, one call per prompt.
//   - Measures wall-clock latency per call; tokens/sec comes from the API's
//     own usage fields (completion_tokens / latency) — never estimated.
//   - Cost per lead is computed ONLY when the model has a verified published
//     price in data/verified-pricing.json. Otherwise cost is null + a note.
//   - Writes data/benchmark-results.json — but ONLY if at least one provider
//     completed at least one real call. A keyless or failed run writes
//     nothing, so a good results file is never overwritten by an empty one.
//
// Usage:
//   NEBIUS_API_KEY=... npm run benchmark
//   Optional: NEBIUS_MODEL (default nvidia/nemotron-3-super-120b-a12b),
//             NEBIUS_BASE_URL (default https://api.tokenfactory.nebius.com/v1)
//
// The Nebius call below mirrors NebiusProvider in lib/model.ts (same
// endpoint, headers, and honesty rules) — plain .mjs can't import the TS.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMPTS_FILE = "data/qualification-prompts.json";
const PRICING_FILE = "data/verified-pricing.json";
const RESULTS_FILE = "data/benchmark-results.json";

const promptsData = JSON.parse(await readFile(path.join(root, PROMPTS_FILE), "utf8"));
const pricingData = JSON.parse(await readFile(path.join(root, PRICING_FILE), "utf8"));
const prompts = promptsData.prompts;
const pricing = pricingData.models ?? {};

const round = (n, dp) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(0.95 * sorted.length) - 1)];
}

// --- Provider configuration -------------------------------------------------
// Only providers with their credentials actually present get measured.
// The stub provider is deliberately never measured: it is not a model, and
// "measuring" it would put meaningless numbers next to real ones.

const providers = [];
if (process.env.NEBIUS_API_KEY) {
  providers.push({
    name: "nebius-token-factory",
    model: process.env.NEBIUS_MODEL || "nvidia/nemotron-3-super-120b-a12b",
    baseUrl: (process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1").replace(/\/+$/, ""),
    apiKey: process.env.NEBIUS_API_KEY,
  });
} else {
  console.log("[benchmark] Nebius provider not configured (NEBIUS_API_KEY is not set) — skipping it.");
}

if (providers.length === 0) {
  console.log(
    "[benchmark] No provider is configured, so there is nothing honest to measure.\n" +
      "[benchmark] Set NEBIUS_API_KEY (create a key at https://tokenfactory.nebius.com/) and re-run.\n" +
      `[benchmark] No results written — an existing ${RESULTS_FILE} (if any) was left untouched.`
  );
  process.exit(0);
}

// --- Run --------------------------------------------------------------------

async function callNebius(provider, prompt) {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? ` — ${body.slice(0, 300)}` : ""}`);
  }
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Response had no choices[0].message.content");
  return { text, usage: json?.usage ?? null };
}

const results = [];

for (const provider of providers) {
  console.log(`[benchmark] ${provider.name} — model ${provider.model}, ${prompts.length} prompts`);
  const latencies = [];
  const tpsSamples = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let usageSeen = false;
  let failures = 0;
  let firstError = null;

  for (const p of prompts) {
    const started = performance.now();
    try {
      const { usage } = await callNebius(provider, p.prompt);
      const latencyMs = performance.now() - started;
      latencies.push(latencyMs);
      if (usage && typeof usage.completion_tokens === "number" && typeof usage.prompt_tokens === "number") {
        usageSeen = true;
        totalPromptTokens += usage.prompt_tokens;
        totalCompletionTokens += usage.completion_tokens;
        if (latencyMs > 0) tpsSamples.push(usage.completion_tokens / (latencyMs / 1000));
      }
      console.log(`  ${p.id}: ${Math.round(latencyMs)} ms`);
    } catch (err) {
      failures += 1;
      firstError ??= err instanceof Error ? err.message : String(err);
      console.log(`  ${p.id}: FAILED — ${firstError}`);
    }
  }

  const calls = latencies.length;
  const price = pricing[provider.model];
  let costPerLeadUsd = null;
  let costNote;
  let pricingSource;
  if (!usageSeen) {
    costNote = "The API returned no usage fields for these calls, so token counts — and therefore cost — are unknown. Nothing was estimated.";
  } else if (price) {
    const totalCost =
      (totalPromptTokens / 1e6) * price.inputUsdPerMillionTokens +
      (totalCompletionTokens / 1e6) * price.outputUsdPerMillionTokens;
    costPerLeadUsd = round(totalCost / calls, 8);
    pricingSource = price.source;
    costNote =
      `Computed from measured token usage and the verified published price for ${provider.model} ` +
      `($${price.inputUsdPerMillionTokens}/1M input, $${price.outputUsdPerMillionTokens}/1M output). ` +
      "Each prompt in the set is one lead conversation, so mean cost per call = cost per lead qualified.";
  } else {
    costNote =
      `No verified published price for model "${provider.model}" is wired into ${PRICING_FILE}, ` +
      "so cost is reported as null. Latency and throughput are measured; price is not guessed.";
  }

  results.push({
    provider: provider.name,
    model: provider.model,
    endpoint: provider.baseUrl,
    status: calls > 0 ? "ok" : "error",
    ...(calls === 0 && firstError ? { note: `All calls failed. First error: ${firstError}` } : {}),
    calls,
    failures,
    meanLatencyMs: calls > 0 ? round(latencies.reduce((a, b) => a + b, 0) / calls, 1) : null,
    p95LatencyMs: calls > 0 ? round(p95(latencies), 1) : null,
    tokensPerSecond:
      tpsSamples.length > 0 ? round(tpsSamples.reduce((a, b) => a + b, 0) / tpsSamples.length, 1) : null,
    totalPromptTokens: usageSeen ? totalPromptTokens : null,
    totalCompletionTokens: usageSeen ? totalCompletionTokens : null,
    costPerLeadUsd,
    costNote,
    ...(pricingSource ? { pricingSource } : {}),
  });
}

// --- Write ------------------------------------------------------------------

const anyMeasured = results.some((r) => r.status === "ok" && r.calls > 0);
if (!anyMeasured) {
  console.error(
    `[benchmark] No provider completed a single call — nothing was measured.\n` +
      `[benchmark] No results written — an existing ${RESULTS_FILE} (if any) was left untouched.`
  );
  process.exit(1);
}

const payload = {
  generatedAt: new Date().toISOString(),
  promptSet: { file: PROMPTS_FILE, count: prompts.length },
  results,
};
await writeFile(path.join(root, RESULTS_FILE), JSON.stringify(payload, null, 2) + "\n");
console.log(`[benchmark] Wrote ${RESULTS_FILE}`);
for (const r of results) {
  console.log(
    `[benchmark] ${r.provider} (${r.model}): ${r.calls} calls, ${r.failures} failures, ` +
      `mean ${r.meanLatencyMs} ms, p95 ${r.p95LatencyMs} ms, ` +
      `${r.tokensPerSecond ?? "n/a"} tok/s, cost/lead ${r.costPerLeadUsd ?? "null (no verified price)"}`
  );
}
