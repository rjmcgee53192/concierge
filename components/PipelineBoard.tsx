"use client";

import { useEffect, useState } from "react";
import type { Lead } from "@/lib/lead";
import { SAMPLE_LEADS } from "@/lib/lead";
import { loadLocalLeads } from "@/lib/store";

const STATUS_STYLES: Record<Lead["status"], string> = {
  New: "bg-zinc-700/60 text-zinc-200",
  Qualifying: "bg-amber-900/60 text-amber-200",
  Qualified: "bg-emerald-900/60 text-emerald-200",
  "Appointment requested": "bg-[#c9a86a]/20 text-[#e8cf9a]",
  Secured: "bg-emerald-600/80 text-white",
};

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#141311] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-50">
            {lead.name}
            {lead.source === "sample" && (
              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 align-middle text-[11px] font-medium text-zinc-300">sample</span>
            )}
          </h3>
          <p className="text-sm text-zinc-400">{lead.contact} · {lead.businessKind === "dealer" ? "Dealership" : lead.businessKind === "realtor" ? "Realtor" : "Other"}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-[#e8cf9a]">{lead.readinessScore}<span className="text-sm font-medium text-zinc-400">/100</span></p>
          <p className="text-xs text-zinc-500">readiness</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><dt className="text-zinc-500">Looking for</dt><dd className="text-zinc-100">{lead.lookingFor}</dd></div>
        <div><dt className="text-zinc-500">Budget</dt><dd className="text-zinc-100">{lead.budget || "—"}</dd></div>
        <div><dt className="text-zinc-500">Timeline</dt><dd className="text-zinc-100">{lead.timeline || "—"}</dd></div>
        <div>
          <dt className="text-zinc-500">Condition grade</dt>
          <dd className="text-zinc-100">{lead.vision ? `${lead.vision.grade} — ${lead.vision.summary}` : "No photo sent"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[lead.status]}`}>{lead.status}</span>
        {lead.appointmentAsk && <span className="text-xs text-zinc-400">Wants: {lead.appointmentAsk}</span>}
      </div>

      <p className="mt-3 text-xs text-zinc-500">Score because: {lead.readinessReasons.join(" · ")}</p>

      {lead.followUpDraft && (
        <div className="mt-3 rounded-xl bg-black/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Follow-up draft — human sends</p>
          <p className="mt-1 text-sm italic text-zinc-300">“{lead.followUpDraft}”</p>
        </div>
      )}
    </article>
  );
}

export default function PipelineBoard() {
  const [leads, setLeads] = useState<Lead[]>(SAMPLE_LEADS);
  useEffect(() => {
    setLeads([...loadLocalLeads(), ...SAMPLE_LEADS]);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {leads.map((l) => (
        <LeadCard key={l.id} lead={l} />
      ))}
    </div>
  );
}
