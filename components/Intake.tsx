"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Lead, LeadDraft, VisionResult } from "@/lib/lead";
import { newLeadId, validateLeadDraft } from "@/lib/lead";
import { IntakeAgent, VisionAgent, QualifierAgent, FollowUpAgent } from "@/lib/agents";
import { saveLocalLead } from "@/lib/store";
import PhotoVision from "./PhotoVision";

type Msg =
  | { role: "agent" | "buyer"; kind: "text"; text: string }
  | { role: "buyer"; kind: "vision"; imageUrl: string; result: VisionResult };

const QUESTIONS = IntakeAgent.questions;

export default function Intake() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "agent", kind: "text", text: QUESTIONS[0].prompt },
  ]);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<LeadDraft>({ source: "intake" });
  const [input, setInput] = useState("");
  const [vision, setVision] = useState<VisionResult | undefined>(undefined);
  const [done, setDone] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const q = QUESTIONS[step];
  const finished = step >= QUESTIONS.length;

  function pushBuyer(text: string) {
    setMessages((m) => [...m, { role: "buyer", kind: "text", text }]);
  }

  function advance(nextDraft: LeadDraft) {
    const next = step + 1;
    setDraft(nextDraft);
    setStep(next);
    if (next < QUESTIONS.length) {
      setMessages((m) => [...m, { role: "agent", kind: "text", text: QUESTIONS[next].prompt }]);
    } else {
      void finish(nextDraft);
    }
  }

  function answer(value: string) {
    if (!q || q.kind === "photo") return;
    pushBuyer(value);
    const key = q.key as keyof LeadDraft;
    advance({ ...draft, [key]: value } as LeadDraft);
    setInput("");
  }

  async function onPhoto(file: File | null) {
    const subject = draft.businessKind === "dealer" ? "car" : "home";
    if (!file) {
      pushBuyer("No photo — let's keep going.");
      advance({ ...draft });
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    const result = await VisionAgent.run(file.name, subject);
    setVision(result);
    setMessages((m) => [...m, { role: "buyer", kind: "vision", imageUrl, result }]);
    const nextDraft = { ...draft, vision: result };
    const next = step + 1;
    setDraft(nextDraft);
    setStep(next);
    if (next < QUESTIONS.length) {
      setMessages((m) => [
        ...m,
        { role: "agent", kind: "text", text: `Got it — I read the photo and noted the condition for the team. ${QUESTIONS[next].prompt}` },
      ]);
    }
  }

  async function finish(finalDraft: LeadDraft) {
    const errors = validateLeadDraft(finalDraft);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    const { score, reasons } = QualifierAgent.score({ ...finalDraft, vision });
    const base: Lead = {
      id: newLeadId(),
      createdAt: new Date().toISOString(),
      name: finalDraft.name ?? "",
      contact: finalDraft.contact ?? "",
      businessKind: (finalDraft.businessKind as Lead["businessKind"]) ?? "other",
      lookingFor: finalDraft.lookingFor ?? "",
      budget: finalDraft.budget ?? "",
      timeline: finalDraft.timeline ?? "",
      situation: finalDraft.situation ?? "",
      appointmentAsk: finalDraft.appointmentAsk ?? "",
      status: finalDraft.appointmentAsk ? "Appointment requested" : score >= 70 ? "Qualified" : "Qualifying",
      readinessScore: score,
      readinessReasons: reasons,
      vision,
      source: "intake",
    };
    const lead = { ...base, followUpDraft: FollowUpAgent.draft(base) };
    saveLocalLead(lead);
    setDone(lead);
    setMessages((m) => [
      ...m,
      {
        role: "agent",
        kind: "text",
        text: `You're in, ${lead.name.split(" ")[0]}. I've passed this to the team as a scored lead — someone real reviews it before you hear back.`,
      },
    ]);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#141311] p-5 shadow-2xl">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#c9a86a]" />
        <p className="text-sm font-semibold tracking-wide text-zinc-200">Live intake — try it like a buyer</p>
      </div>

      <div className="slim-scroll max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {messages.map((m, i) =>
          m.kind === "vision" ? (
            <div key={i} className="ml-auto max-w-[92%] rounded-2xl bg-[#1d1b16] p-3">
              <PhotoVision imageUrl={m.imageUrl} result={m.result} />
            </div>
          ) : (
            <div
              key={i}
              className={
                m.role === "agent"
                  ? "max-w-[85%] rounded-2xl rounded-bl-sm bg-white/[0.06] px-4 py-3 text-[15px] text-zinc-100"
                  : "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#c9a86a] px-4 py-3 text-[15px] font-medium text-black"
              }
            >
              {m.text}
            </div>
          ),
        )}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>}

      {!finished && q && (
        <div className="mt-4 border-t border-white/10 pt-4">
          {q.kind === "choice" && q.choices && (
            <div className="flex flex-wrap gap-2">
              {q.choices.map((c) => (
                <button
                  key={c}
                  onClick={() => answer(c)}
                  className="rounded-full border border-[#c9a86a]/50 px-4 py-2 text-sm text-[#e8cf9a] transition hover:bg-[#c9a86a] hover:text-black"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {q.kind === "text" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) answer(input.trim());
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer…"
                className="flex-1 rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:border-[#c9a86a] focus:outline-none"
              />
              <button type="submit" className="rounded-xl bg-[#c9a86a] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#dbbd82]">
                Send
              </button>
            </form>
          )}
          {q.kind === "photo" && (
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)} />
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-xl bg-[#c9a86a] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#dbbd82]"
              >
                Add a photo
              </button>
              <button
                onClick={() => void onPhoto(null)}
                className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-zinc-300 hover:border-white/40"
              >
                Skip
              </button>
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="mt-4 rounded-xl border border-[#c9a86a]/40 bg-[#c9a86a]/[0.07] p-4">
          <p className="text-sm font-semibold text-[#e8cf9a]">Lead created — readiness {done.readinessScore}/100 · {done.status}</p>
          <p className="mt-1 text-sm text-zinc-300">Why: {done.readinessReasons.join(" · ")}</p>
          <p className="mt-2 text-sm italic text-zinc-400">Follow-up draft (a human sends this): “{done.followUpDraft}”</p>
          <Link href="/pipeline" className="mt-3 inline-block text-sm font-semibold text-[#e8cf9a] underline underline-offset-4">
            See it in the pipeline →
          </Link>
        </div>
      )}
    </div>
  );
}
