# Concierge architecture

## The one path (v0)

```
Buyer
  │
  ▼
Intake UI (components/Intake.tsx) ── chat-style questions from IntakeAgent
  │
  ├─ photo? ──► VisionAgent ──► VisionProvider ──┬─ StubVisionProvider (default, v0)
  │                                              └─ SamVisionProvider (SAM 3.1, Oct 26 if Meta accepts)
  ▼
LeadDraft ──► validateLeadDraft (lib/lead.ts) — strict schema, plain-language errors
  │
  ├─► QualifierAgent — readiness 0–100, every point has a printed reason
  ├─► FollowUpAgent — drafts the follow-up (a human sends it — by design)
  ▼
Lead (lib/lead.ts) ──► localStorage (v0) ──► Pipeline UI (/pipeline)

Model calls (when agents need them):
  agents ──► ModelProvider (lib/model.ts) ──┬─ StubModelProvider (default, v0)
                                             ├─ MuseModelProvider (Meta, Oct 26)
                                             └─ NebiusProvider (Nebius Token Factory — real,
                                                key-gated: active when NEBIUS_API_KEY is set)

Benchmark (Nebius adapter):
  scripts/benchmark.mjs ──► fixed prompts (data/qualification-prompts.json)
                        ──► each configured provider (today: Nebius Token Factory)
                        ──► data/benchmark-results.json ──► /benchmark page renders it
                            (verified prices only, from data/verified-pricing.json;
                             no results file = the page shows "Not measured yet")
```

## Pieces

| File | Job |
| --- | --- |
| `lib/lead.ts` | The Lead type, statuses, validator, sample leads. The contract everything else shares. |
| `lib/agents.ts` | IntakeAgent (question script), VisionAgent, QualifierAgent (transparent scoring), FollowUpAgent (drafts only). |
| `lib/vision.ts` | VisionProvider interface, stub provider, SAM 3.1 placeholder. Segments are % coordinates so any photo size works. |
| `lib/model.ts` | ModelProvider interface, stub provider, Muse placeholder, and the Nebius Token Factory provider (OpenAI-compatible chat completions via fetch; env-configured, keyless = throws "not configured"). |
| `lib/benchmark.ts` | Benchmark types + the shared prompt-set / verified-pricing data the page and the harness both read. |
| `scripts/benchmark.mjs` | The harness: runs the fixed prompt set through each configured provider, measures latency + tokens/sec from API usage fields, writes `data/benchmark-results.json`. Writes only when real calls succeeded. |
| `data/qualification-prompts.json` | The fixed qualification prompt set (four lead conversations from the intake script / sample leads). Same prompts for every provider, every run. |
| `data/verified-pricing.json` | Published per-token prices verified against named sources. Cost is computed only for models listed here; anything else reports cost as null. |
| `tests/core.test.mjs` | Core-logic tests (validator, qualifier, follow-up, intake order, provider honesty). `npm test` compiles `lib/` with the project's TypeScript and runs them on Node's built-in runner — no extra dependencies. |
| `lib/store.ts` | localStorage persistence for leads created on this device. |
| `components/Intake.tsx` | The chat flow: questions → photo moment → scored lead. |
| `components/PhotoVision.tsx` | Photo with animated segmentation overlay + condition grade. |
| `components/PipelineBoard.tsx` | Lead cards: buyer, budget, timeline, grade, score + reasons, status, follow-up draft. |
| `app/benchmark/page.tsx` | Nebius adapter surface — renders `data/benchmark-results.json` when the harness has produced one (with measured-at time and model), honest "Not measured yet" state until then. Rendered per request so a fresh run shows without a rebuild. |

## Design choices worth noting

- **Providers behind interfaces** so each hackathon adapter is a swap, not a fork.
  Placeholders throw instead of faking a response — a broken demo can be explained,
  a faked one can't.
- **Scoring is rules-based and printed on the card.** v0 doesn't need a model to
  explain "budget stated + buying this month = ready." When Muse lands, it can
  enrich the reasons, but the audit trail stays.
- **Follow-ups are drafts.** The human-in-the-loop step is a product decision
  (trust with high-end buyers), and later the trust story for agentic payments.
- **Storage is localStorage in v0** on purpose: one end-to-end path, no backend
  to babysit. A real backend (Supabase) is a post-skeleton step.
- **Benchmark numbers are measured or absent.** The harness derives
  tokens/sec from the API's own usage fields, computes cost only for models
  with a verified published price (`data/verified-pricing.json`), and refuses
  to write a results file on a keyless or failed run — so the page can never
  end up showing an empty run dressed as data.
