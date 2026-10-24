import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BenchmarkProviderResult, BenchmarkResultsFile } from "../../lib/benchmark";
import { isMeasured } from "../../lib/benchmark";

// The results file is written by the harness at run time, not build time —
// render per request so a fresh benchmark run shows up without a rebuild.
export const dynamic = "force-dynamic";

export const metadata = { title: "Benchmark — Concierge" };

async function loadResults(): Promise<BenchmarkResultsFile | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "benchmark-results.json"), "utf8");
    return JSON.parse(raw) as BenchmarkResultsFile;
  } catch {
    return null;
  }
}

function fmtMs(v: number | null): string {
  return v === null ? "—" : `${Math.round(v).toLocaleString()} ms`;
}

function fmtTps(v: number | null): string {
  return v === null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function fmtCost(v: number | null): string {
  if (v === null) return "Not computed";
  return `$${v.toFixed(4)}`;
}

function MeasuredRow({ r }: { r: BenchmarkProviderResult }) {
  return (
    <>
      <tr className="border-t border-white/[0.06]">
        <td className="px-4 py-3 text-zinc-100">{r.provider}</td>
        <td className="px-4 py-3 text-zinc-300">{r.model}</td>
        <td className="px-4 py-3 text-zinc-100">{fmtMs(r.meanLatencyMs)}</td>
        <td className="px-4 py-3 text-zinc-100">{fmtMs(r.p95LatencyMs)}</td>
        <td className="px-4 py-3 text-zinc-100">{fmtTps(r.tokensPerSecond)}</td>
        <td className="px-4 py-3 text-zinc-100">{fmtCost(r.costPerLeadUsd)}</td>
      </tr>
      <tr className="border-t border-white/[0.03]">
        <td colSpan={6} className="px-4 pb-3 pt-0 text-xs text-zinc-500">
          {r.calls} calls, {r.failures} failures
          {r.totalPromptTokens !== null && r.totalCompletionTokens !== null
            ? ` · ${r.totalPromptTokens.toLocaleString()} prompt tokens, ${r.totalCompletionTokens.toLocaleString()} completion tokens`
            : " · API returned no usage fields for these calls"}
          {` · ${r.costNote}`}
          {r.pricingSource ? ` Price source: ${r.pricingSource}` : ""}
        </td>
      </tr>
    </>
  );
}

export default async function BenchmarkPage() {
  const data = await loadResults();
  const measured = data?.results.filter(isMeasured) ?? [];
  const hasMeasured = measured.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Inference benchmark</h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        For the Nebius × NVIDIA entry, the pitch is measured, not claimed: what does one
        qualified lead cost, and how fast does the buyer get an answer? The harness
        (<code className="text-zinc-300">npm run benchmark</code>) runs the same fixed
        qualification prompts through each configured provider and records the numbers here.
      </p>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-white/[0.04] text-zinc-300">
            <tr>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Model</th>
              <th className="px-4 py-3 font-semibold">Latency (mean)</th>
              <th className="px-4 py-3 font-semibold">Latency (p95)</th>
              <th className="px-4 py-3 font-semibold">Tokens / sec</th>
              <th className="px-4 py-3 font-semibold">Cost per qualified lead</th>
            </tr>
          </thead>
          <tbody>
            {hasMeasured ? (
              measured.map((r) => <MeasuredRow key={`${r.provider}-${r.model}`} r={r} />)
            ) : (
              <tr className="border-t border-white/[0.06]">
                <td className="px-4 py-3 text-zinc-100">Nebius Token Factory</td>
                <td className="px-4 py-3 text-zinc-300">Nemotron (NVIDIA open model)</td>
                <td className="px-4 py-3 text-zinc-500" colSpan={4}>
                  Not measured yet — the harness is ready; it runs once a Nebius API key is configured
                </td>
              </tr>
            )}
            <tr className="border-t border-white/[0.06]">
              <td className="px-4 py-3 text-zinc-100">Baseline (frontier hosted model)</td>
              <td className="px-4 py-3 text-zinc-300">To be selected for the comparison run</td>
              <td className="px-4 py-3 text-zinc-500" colSpan={4}>
                Not measured yet — no baseline provider configured
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {hasMeasured && data ? (
        <p className="mt-4 max-w-2xl text-sm text-zinc-500">
          Measured {new Date(data.generatedAt).toLocaleString()} · {data.promptSet.count} fixed
          qualification prompts ({data.promptSet.file}) · same prompts, same machine, same run for
          every provider in the table.
        </p>
      ) : (
        <p className="mt-4 max-w-2xl text-sm text-zinc-500">
          {data
            ? "A results file exists but contains no completed measurements, so nothing is shown. "
            : ""}
          No numbers are shown until they&apos;ve actually been measured on the same prompts,
          same machine, same day. An empty cell here is worth more than an invented one —
          judges can ask how a number was produced, and &quot;we ran it&quot; is the only good answer.
        </p>
      )}
    </div>
  );
}
