# Concierge — the AI receptionist that can see

Concierge qualifies buyers for small luxury businesses — realtors, dealers, the kind
of shops that lose real money when nobody picks up the phone. Plenty of tools can chat
with a buyer. Concierge can also *see*: when a buyer sends a photo — their trade-in, a
home they want, damage worth knowing about — it reads the photo, grades what it finds,
and builds the lead around it. The output isn't a transcript, it's a scored lead in a
pipeline, with an appointment ask and a follow-up draft a human can send.

I built the first version of this idea as a browser receptionist for luxury home and
car sales. This is the rebuild: same problem, proper agent architecture, and vision
as the centerpiece instead of an add-on.

## Run it

You need Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000 — run the intake like a buyer (add a photo when it asks),
then check `/pipeline` to see your lead land, scored, next to the sample leads.
`/benchmark` is where the Nebius numbers will go once they've actually been measured.

```bash
npm test
```

Core-logic tests (`tests/core.test.mjs`, Node's built-in runner — no extra
install): the Lead validator, the transparent readiness scoring, the follow-up
drafter, the intake question order, and the provider honesty rules (stubs flag
themselves; unwired or keyless providers throw instead of faking a result).
They've already earned their keep — the first run caught the validator
rejecting normally formatted phone numbers like (555) 014-2280, sample lead
included; that's fixed in `lib/lead.ts`.

## What's real and what's stubbed (honest status)

- **Real:** the intake flow, the strict Lead schema + validator (`lib/lead.ts`),
  the four agents (`lib/agents.ts`), readiness scoring with stated reasons, the
  follow-up drafter, the pipeline, the photo overlay experience.
- **Stubbed behind interfaces:** vision analysis.
  `lib/vision.ts` has a `VisionProvider` interface — today the stub returns canned
  segments (it does not look at your photo, and results are flagged `stubbed: true`);
  `SamVisionProvider` is the placeholder where SAM 3.1 gets wired.
- **Real but key-gated:** the language model. `lib/model.ts` has the stub
  (default), a Muse Spark placeholder, and a working `NebiusProvider` for
  Nebius Token Factory that activates when `NEBIUS_API_KEY` is set — see the
  Nebius section below. No fake API calls, no invented keys.

Why build it this way? Most hackathon API access doesn't exist yet. Building against the
interfaces now means Oct 26 is a swap-in day, not a rewrite day.

## Nebius × NVIDIA adapter — same brain, measured

The Nebius entry runs the same Concierge core on an NVIDIA open model served
by Nebius Token Factory, and proves it with measurements instead of claims.

Facts verified against Nebius's own docs and blog on 2026-10-24:

- **Base URL:** `https://api.tokenfactory.nebius.com/v1/` — OpenAI-compatible
  (`POST /v1/chat/completions`, `Authorization: Bearer <key>`; responses carry
  `usage` token counts). Source: docs.tokenfactory.nebius.com.
- **Nemotron models served on Token Factory** include
  `nvidia/nemotron-3-super-120b-a12b` (Nemotron 3 Super, text) and
  `nvidia/Nemotron-3.5-Super-VL` (vision-language).
- **Published pricing found for one model:** Nemotron 3.5 Super VL at
  $0.30 per million input tokens and $0.90 per million output tokens
  (Nebius blog, 2026-10-16). No verified published price was found wired in
  for the other models — the harness reports their cost as `null` rather
  than guessing. The verified table lives in `data/verified-pricing.json`,
  each entry with its source.

### Setup (the key is your step)

1. Sign up at https://tokenfactory.nebius.com/ and create an API key
   (API keys section → Create API key). Save it when shown — it isn't
   displayed again. Account creation is the entrant's own step; nothing in
   this repo creates accounts.
2. Copy `.env.example` to `.env` and set `NEBIUS_API_KEY`. Optionally set
   `NEBIUS_MODEL` (default `nvidia/nemotron-3-super-120b-a12b`) and
   `NEBIUS_BASE_URL` (default the documented endpoint above).

With the key set, `getModelProvider()` returns the real
`NebiusProvider` (`lib/model.ts`); without it, the app stays on the stub.
Either way there are no fake completions — a keyless Nebius provider throws
a "not configured" error instead of inventing text.

### Run the benchmark

```bash
npm run benchmark
```

The harness (`scripts/benchmark.mjs`) runs the fixed qualification prompt
set — `data/qualification-prompts.json`, four lead conversations built from
the IntakeAgent script and the sample leads in `lib/lead.ts` — through each
configured provider, measures wall-clock latency per call, derives
tokens/sec from the API's usage fields, and writes
`data/benchmark-results.json` (timestamp, model, prompt count, mean/p95
latency, tokens/sec, and cost per qualified lead when a verified price
exists). `/benchmark` renders that file when it exists — with when it was
measured — and keeps its honest "Not measured yet" state when it doesn't.
If no provider is configured, the script says so and writes nothing; a
failed run never overwrites a good results file.

### What remains for the Nebius submission

- Run the benchmark with a real key so `/benchmark` shows measured numbers.
- Choose and configure a baseline provider for the comparison row (not
  wired yet — the page says so).
- Enter on Devpost before the Oct 30 deadline and submit the project —
  the entrant's own taps. This repo builds the project; it does not submit it.

## The adapter plan (one core, three competitions)

- **Meta Global AI Developer Hackathon** (submit Nov 4): wire Muse Spark as the
  model provider, SAM 3.1 as the vision provider, Muse Image for follow-up visuals.
- **Nebius × NVIDIA** (Oct 30): Nemotron via Nebius Token Factory as the model
  provider — adapter and benchmark harness are built (below); what remains is
  a real key, a measured run to fill `/benchmark`, and the Devpost entry.
- **PayPal AI** (Nov 12): add the close — a deposit flow on the qualified lead so
  an appointment becomes a secured booking instead of a no-show.

## Architecture

Four small agents pass a Lead between them — Intake asks, Vision reads the photo,
Qualifier scores with reasons, Follow-up drafts. Model and vision sit behind
provider interfaces so adapters are config swaps. Details and a diagram:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## License

MIT — see `LICENSE`.
