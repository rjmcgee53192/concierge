import Link from "next/link";
import Intake from "@/components/Intake";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5">
      <section className="animate-fade-up pb-10 pt-14 text-center sm:pt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a86a]">For realtors &amp; dealers who miss calls</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Concierge — the AI receptionist <span className="text-[#e8cf9a]">that can see.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-300">
          Concierge qualifies buyers for small luxury businesses from conversation <em>and</em> photos —
          a trade-in, a home they love, damage worth knowing about — and turns them into booked
          appointments in a lead pipeline your team can actually work.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href="#intake" className="rounded-xl bg-[#c9a86a] px-6 py-3 font-semibold text-black hover:bg-[#dbbd82]">Try the intake</a>
          <Link href="/pipeline" className="rounded-xl border border-white/20 px-6 py-3 font-semibold text-zinc-100 hover:border-[#c9a86a]/60">See the pipeline</Link>
        </div>
      </section>

      <section className="grid gap-4 pb-12 sm:grid-cols-3">
        {[
          {
            title: "It reads the photo",
            body: "Buyers send pictures, not paragraphs. Concierge segments what's in the frame, grades the condition, and builds the lead around what it finds — not just what they typed.",
          },
          {
            title: "Every lead, scored out loud",
            body: "Readiness is computed from what the buyer actually said — budget, timeline, trade-in, appointment ask — with the reasons printed on the card. No black-box scores.",
          },
          {
            title: "A human still sends",
            body: "Concierge drafts the follow-up; a person on your team sends it. High-end buyers can smell a fully automated email, and missed-call recovery only works if they reply.",
          },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl border border-white/10 bg-[#141311] p-5">
            <h2 className="font-semibold text-[#e8cf9a]">{c.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{c.body}</p>
          </div>
        ))}
      </section>

      <section id="intake" className="mx-auto max-w-2xl pb-16">
        <Intake />
        <p className="mt-3 text-center text-xs text-zinc-500">
          Photos are read by a stub vision provider in v0 — the overlay is the real experience,
          the analysis swaps to SAM 3.1 when Meta API access lands.
        </p>
      </section>
    </div>
  );
}
