import type { Lead, LeadDraft, VisionResult } from "./lead";
import { validateLeadDraft } from "./lead";
import { getVisionProvider } from "./vision";

// Four small agents, each with one job. They pass a Lead between them the
// way a good front desk passes a file — nobody holds the whole thing at once.

export interface IntakeQuestion {
  key: keyof LeadDraft | "photoSubject";
  prompt: string;
  hint?: string;
  choices?: string[];
  kind: "text" | "choice" | "photo";
}

export const IntakeAgent = {
  // Order matters: easy questions first, contact details last, photo in the
  // middle while they're still engaged — that's the demo moment.
  questions: [
    {
      key: "businessKind",
      prompt: "Welcome in. Are you shopping with a dealership, a realtor, or someone else?",
      choices: ["dealer", "realtor", "other"],
      kind: "choice",
    },
    {
      key: "lookingFor",
      prompt: "What are you looking for? Be as specific as you like — model, style, neighborhood, must-haves.",
      kind: "text",
    },
    {
      key: "budget",
      prompt: "What budget range are you working with?",
      choices: ["Under $50k", "$50k–$150k", "$150k–$400k", "$400k–$750k", "$750k+", "Not sure yet"],
      kind: "choice",
    },
    {
      key: "timeline",
      prompt: "How soon are you hoping to make a move?",
      choices: ["This week", "This month", "Next 60 days", "Just researching"],
      kind: "choice",
    },
    {
      key: "situation",
      prompt: "Anything about your current situation that helps? A trade-in, a home to sell, pre-approval — whatever applies.",
      kind: "text",
    },
    {
      key: "photoSubject",
      prompt: "If you have a photo — your trade-in, a home you like, anything you'd want us to look at — add it now and I'll read it for you. Or skip this step.",
      kind: "photo",
    },
    {
      key: "appointmentAsk",
      prompt: "Last thing before your details: if we find the right fit, when would you want to come in or see it?",
      kind: "text",
    },
    { key: "name", prompt: "And your name?", kind: "text" },
    {
      key: "contact",
      prompt: "Best email or phone for the follow-up? A real person reviews every lead before anything is sent.",
      kind: "text",
    },
  ] as IntakeQuestion[],
};

export const VisionAgent = {
  async run(photoName: string, subject: "car" | "home"): Promise<VisionResult> {
    return getVisionProvider().analyze(photoName, subject);
  },
};

export const QualifierAgent = {
  // Transparent on purpose: every point has a stated reason, shown in the
  // pipeline. A score a salesperson can't explain is a score they won't trust.
  score(draft: LeadDraft): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const filled = (v?: string) => !!v && v.trim().length > 2;

    if (filled(draft.lookingFor)) { score += 15; reasons.push("Said what they're looking for"); }
    if (filled(draft.budget) && draft.budget !== "Not sure yet") { score += 20; reasons.push("Budget stated"); }
    if (draft.timeline === "This week") { score += 25; reasons.push("Buying this week"); }
    else if (draft.timeline === "This month") { score += 20; reasons.push("Buying this month"); }
    else if (draft.timeline === "Next 60 days") { score += 12; reasons.push("Timeline under 90 days"); }
    else if (filled(draft.timeline)) { score += 4; reasons.push("Researching — longer nurture"); }
    if (filled(draft.situation)) {
      score += 15;
      reasons.push(/trade|current|sell/i.test(draft.situation!) ? "Has a trade-in / current situation" : "Shared their situation");
    }
    if (draft.vision) { score += 10; reasons.push(`Sent a photo (condition grade ${draft.vision.grade})`); }
    if (filled(draft.appointmentAsk)) { score += 10; reasons.push("Asked for an appointment window"); }
    if (validateLeadDraft(draft).length === 0) { score += 5; reasons.push("Contact details complete"); }

    return { score: Math.min(100, score), reasons };
  },
};

export const FollowUpAgent = {
  // Draft only — a human sends it. That guardrail is part of the product,
  // not a missing feature: luxury buyers can smell a fully-auto email.
  draft(lead: Lead): string {
    const first = lead.name.split(" ")[0] || "there";
    const visionLine = lead.vision
      ? ` I looked at the photo you sent — ${lead.vision.summary.charAt(0).toLowerCase()}${lead.vision.summary.slice(1)}`
      : "";
    const appt = lead.appointmentAsk
      ? ` You mentioned ${lead.appointmentAsk.toLowerCase()} — I'll confirm a time that fits and hold it for you.`
      : "";
    return `Hi ${first} — thanks for telling us what you're after (${lead.lookingFor.toLowerCase()}).${visionLine}${appt} If anything changes on your end, just reply here and we'll adjust.`;
  },
};
