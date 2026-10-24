import type { Lead } from "./lead";
import { SAMPLE_LEADS } from "./lead";

// v0 storage is just localStorage. The pipeline merges whatever the intake
// created on this device with the labelled sample leads.
const KEY = "concierge-leads-v0";

export function loadLocalLeads(): Lead[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Lead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalLead(lead: Lead) {
  const existing = loadLocalLeads();
  window.localStorage.setItem(KEY, JSON.stringify([lead, ...existing]));
}

export function allLeads(): Lead[] {
  return [...loadLocalLeads(), ...SAMPLE_LEADS];
}
