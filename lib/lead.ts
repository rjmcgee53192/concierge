// Lead shape is the contract everything else works against.
// Intake fills it, agents read it, the pipeline renders it. Keep it strict —
// a half-filled lead is exactly what a human receptionist would lose on a sticky note.

export type BusinessKind = "realtor" | "dealer" | "other";
export type LeadStatus =
  | "New"
  | "Qualifying"
  | "Qualified"
  | "Appointment requested"
  | "Secured";

export type ConditionGrade = "A" | "B" | "C";

export interface VisionSegment {
  label: string;
  note: string;
  // Box in % of image width/height so it works on any photo size.
  x: number;
  y: number;
  w: number;
  h: number;
  severity: "clean" | "minor" | "attention";
}

export interface VisionResult {
  provider: string;
  stubbed: boolean;
  subject: "car" | "home" | "unknown";
  segments: VisionSegment[];
  grade: ConditionGrade;
  summary: string;
}

export interface Lead {
  id: string;
  createdAt: string;
  name: string;
  contact: string;
  businessKind: BusinessKind;
  lookingFor: string;
  budget: string;
  timeline: string;
  situation: string; // trade-in, current home, financing — whatever they volunteered
  appointmentAsk: string;
  status: LeadStatus;
  readinessScore: number; // 0-100, set by QualifierAgent
  readinessReasons: string[];
  vision?: VisionResult;
  followUpDraft?: string;
  source: "intake" | "sample";
}

export type LeadDraft = Partial<Lead> & {
  name?: string;
  contact?: string;
  lookingFor?: string;
};

// No zod in v0 — this hand check is small enough to read in one pass,
// and it gives the intake UI plain-language errors to show the buyer.
export function validateLeadDraft(draft: LeadDraft): string[] {
  const errors: string[] = [];
  if (!draft.name || draft.name.trim().length < 2) errors.push("Name is missing.");
  // Phone check counts digits after stripping formatting — "(555) 014-2280"
  // is a perfectly good phone number even though no 7 digits run together.
  // (The core tests caught the old consecutive-digits regex rejecting it,
  // including one of the sample leads below.)
  if (!draft.contact || !(draft.contact.includes("@") || draft.contact.replace(/\D/g, "").length >= 7))
    errors.push("Contact needs an email or a phone number with at least 7 digits.");
  if (!draft.lookingFor || draft.lookingFor.trim().length < 3)
    errors.push("What they're looking for is missing.");
  if (draft.readinessScore !== undefined && (draft.readinessScore < 0 || draft.readinessScore > 100))
    errors.push("Readiness score must be between 0 and 100.");
  return errors;
}

export function newLeadId(): string {
  return `lead-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

// Sample leads so the pipeline isn't empty on first load. Obviously sample data —
// labelled source:"sample" and the UI badges them as such.
export const SAMPLE_LEADS: Lead[] = [
  {
    id: "sample-1",
    createdAt: "2026-10-23T15:12:00",
    name: "Marcus Bell",
    contact: "marcus.b@example.com",
    businessKind: "dealer",
    lookingFor: "Grand touring coupe, V8, under 40k miles",
    budget: "$70k–$85k",
    timeline: "This month",
    situation: "Trading in a 2021 sedan, one owner, dealer serviced",
    appointmentAsk: "Saturday morning test drive",
    status: "Qualified",
    readinessScore: 86,
    readinessReasons: ["Budget stated", "Buying this month", "Has a trade-in"],
    vision: {
      provider: "stub",
      stubbed: true,
      subject: "car",
      grade: "B",
      summary: "Trade-in reads clean overall with minor curb rash on one wheel.",
      segments: [
        { label: "exterior", note: "clean", x: 6, y: 18, w: 62, h: 52, severity: "clean" },
        { label: "wheel — rear", note: "curb rash", x: 66, y: 58, w: 20, h: 26, severity: "minor" },
      ],
    },
    followUpDraft:
      "Hi Marcus — thanks for sending the photos. Your trade-in looks well kept; the only thing I flagged was light curb rash on the rear wheel, which won't hurt your number much. I can hold the coupe for a Saturday morning test drive if that still works for you.",
    source: "sample",
  },
  {
    id: "sample-2",
    createdAt: "2026-10-23T11:40:00",
    name: "Elena Rodriguez",
    contact: "(555) 014-2280",
    businessKind: "realtor",
    lookingFor: "4-bed home, garden district feel, good schools",
    budget: "$650k–$750k",
    timeline: "Next 60 days",
    situation: "Pre-approved, current home not yet listed",
    appointmentAsk: "Weekday evening viewing",
    status: "Appointment requested",
    readinessScore: 78,
    readinessReasons: ["Budget stated", "Pre-approved (per buyer)", "Timeline under 90 days"],
    followUpDraft:
      "Hi Elena — good news, two homes in your range just came up that match what you described. I can line up evening viewings this week so you see them before the weekend crowd. Want me to lock in Thursday?",
    source: "sample",
  },
];
