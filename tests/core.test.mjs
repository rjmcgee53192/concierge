// Core-logic tests — Gate 7 (repo hygiene: tests on the core logic).
// These run against the real lib/ modules, compiled by the project's own
// TypeScript (see the "test" script in package.json). No test framework to
// install: Node's built-in runner does the job, so a judge can run this in
// under a minute. What's covered is the stuff a wrong change would quietly
// break — the Lead validator, the transparent readiness scoring, the
// follow-up drafter, the intake order, and the honesty rules for providers
// (stubs say they're stubs; unwired/keyless providers throw, never fake).

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateLeadDraft, SAMPLE_LEADS } from "../.test-build/lead.js";
import { IntakeAgent, QualifierAgent, FollowUpAgent } from "../.test-build/agents.js";
import { StubVisionProvider, SamVisionProvider, getVisionProvider } from "../.test-build/vision.js";
import { StubModelProvider, MuseModelProvider, NebiusProvider, getModelProvider } from "../.test-build/model.js";

const FULL_DRAFT = {
  name: "Jamie Ortiz",
  contact: "jamie@example.com",
  lookingFor: "3-bed home near good schools",
  budget: "$400k–$750k",
  timeline: "This month",
  situation: "Has a trade-in sedan, one owner",
  appointmentAsk: "Saturday morning viewing",
};

// --- Lead validator -------------------------------------------------------

test("validator accepts a complete draft", () => {
  assert.deepEqual(validateLeadDraft(FULL_DRAFT), []);
});

test("validator flags missing name, bad contact, and missing ask", () => {
  const errors = validateLeadDraft({ contact: "not-a-contact" });
  assert.equal(errors.length, 3);
  assert.match(errors[0], /Name/);
  assert.match(errors[1], /Contact/);
  assert.match(errors[2], /looking for/);
});

test("validator accepts a phone contact with 7+ digits and rejects score > 100", () => {
  assert.deepEqual(
    validateLeadDraft({ name: "Jo", contact: "(555) 014-2280", lookingFor: "a coupe" }),
    [],
  );
  const errors = validateLeadDraft({ ...FULL_DRAFT, readinessScore: 101 });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /between 0 and 100/);
});

test("sample leads are valid and labelled as samples", () => {
  assert.ok(SAMPLE_LEADS.length >= 2);
  for (const lead of SAMPLE_LEADS) {
    assert.deepEqual(validateLeadDraft(lead), [], `sample lead ${lead.id} should validate`);
    assert.equal(lead.source, "sample");
  }
});

// --- Qualifier scoring (transparent rules — every point needs a reason) ---

test("qualifier gives an empty draft a zero score and no reasons", () => {
  const { score, reasons } = QualifierAgent.score({});
  assert.equal(score, 0);
  assert.deepEqual(reasons, []);
});

test("qualifier scores a complete, this-month buyer high — with reasons for the points", () => {
  const { score, reasons } = QualifierAgent.score(FULL_DRAFT);
  // 15 lookingFor + 20 budget + 20 this-month + 15 situation + 10 appointment + 5 complete
  assert.equal(score, 85);
  assert.ok(reasons.length >= 5);
  assert.ok(reasons.some((r) => /Budget stated/.test(r)));
  assert.ok(reasons.some((r) => /this month/.test(r)));
});

test("qualifier does not award budget points for 'Not sure yet'", () => {
  const unsure = QualifierAgent.score({ ...FULL_DRAFT, budget: "Not sure yet" });
  const stated = QualifierAgent.score(FULL_DRAFT);
  assert.equal(stated.score - unsure.score, 20);
  assert.ok(!unsure.reasons.some((r) => /Budget stated/.test(r)));
});

test("qualifier timeline points decrease as the timeline stretches", () => {
  const week = QualifierAgent.score({ ...FULL_DRAFT, timeline: "This week" }).score;
  const month = QualifierAgent.score({ ...FULL_DRAFT, timeline: "This month" }).score;
  const sixty = QualifierAgent.score({ ...FULL_DRAFT, timeline: "Next 60 days" }).score;
  const browsing = QualifierAgent.score({ ...FULL_DRAFT, timeline: "Just researching" }).score;
  assert.ok(week > month && month > sixty && sixty > browsing);
});

test("qualifier adds a photo bonus and never scores above 100", () => {
  const vision = { provider: "stub", stubbed: true, subject: "car", segments: [], grade: "B", summary: "Clean overall." };
  const withPhoto = QualifierAgent.score({ ...FULL_DRAFT, timeline: "This week", vision });
  assert.equal(withPhoto.score, 100); // 90 without the cap + 10 photo, capped at 100
  assert.ok(withPhoto.reasons.some((r) => /photo/i.test(r)));
});

// --- Follow-up drafter ----------------------------------------------------

test("follow-up draft greets by first name and stays a draft (mentions what they want)", () => {
  const lead = { ...FULL_DRAFT, lookingFor: "Grand touring coupe", appointmentAsk: "Saturday test drive" };
  const draft = FollowUpAgent.draft(lead);
  assert.match(draft, /^Hi Jamie —/);
  assert.match(draft, /grand touring coupe/);
  assert.match(draft, /saturday test drive/);
});

test("follow-up draft includes the vision summary only when a photo was read", () => {
  const base = { ...FULL_DRAFT, lookingFor: "a coupe", appointmentAsk: "" };
  assert.ok(!/looked at the photo/.test(FollowUpAgent.draft(base)));
  const withVision = { ...base, vision: { provider: "stub", stubbed: true, subject: "car", segments: [], grade: "B", summary: "Reads clean overall." } };
  assert.match(FollowUpAgent.draft(withVision), /looked at the photo you sent — reads clean overall\./);
});

// --- Intake order (spec: photo in the middle, contact details last) -------

test("intake asks its questions in the spec order, photo before contact details", () => {
  const keys = IntakeAgent.questions.map((q) => q.key);
  assert.equal(keys.length, 9);
  assert.equal(keys[0], "businessKind");
  assert.ok(keys.indexOf("photoSubject") > keys.indexOf("situation"));
  assert.ok(keys.indexOf("photoSubject") < keys.indexOf("name"));
  assert.equal(keys[keys.length - 1], "contact");
});

// --- Provider honesty -----------------------------------------------------

test("vision stub flags itself stubbed and grades one 'attention' segment as B", async () => {
  const provider = new StubVisionProvider();
  for (const subject of ["car", "home"]) {
    const result = await provider.analyze("photo.jpg", subject);
    assert.equal(result.stubbed, true);
    assert.equal(result.provider, "stub");
    assert.equal(result.grade, "B"); // each canned set has exactly one attention segment
    assert.ok(result.segments.length >= 3);
  }
  assert.equal(getVisionProvider().name, "stub");
});

test("SAM provider throws until it is really wired — it never fakes a result", async () => {
  await assert.rejects(() => new SamVisionProvider().analyze(), /not wired yet/);
});

test("model providers: stub echoes honestly, Muse throws, keyless Nebius refuses", async () => {
  assert.match(await new StubModelProvider().complete("hello world"), /^\[stub model\] hello world/);
  await assert.rejects(() => new MuseModelProvider().complete(), /not wired yet/);

  const keyless = new NebiusProvider({ apiKey: "" });
  assert.equal(keyless.configured, false);
  await assert.rejects(() => keyless.complete("qualify this lead"), /not configured/);

  const keyed = new NebiusProvider({ apiKey: "test-key-not-real" });
  assert.equal(keyed.configured, true);
  assert.equal(keyed.model, "nvidia/nemotron-3-super-120b-a12b");
});

test("getModelProvider falls back to the stub when no Nebius key is in the env", () => {
  const saved = process.env.NEBIUS_API_KEY;
  delete process.env.NEBIUS_API_KEY;
  try {
    assert.equal(getModelProvider().name, "stub");
  } finally {
    if (saved !== undefined) process.env.NEBIUS_API_KEY = saved;
  }
});
