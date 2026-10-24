import type { VisionResult, VisionSegment } from "./lead";

// Vision sits behind the same kind of interface as the model layer.
// In the Meta build this is the load-bearing piece: SAM 3.1 segments the
// buyer's photo, and the rest of the lead is built around what it finds.

export interface VisionProvider {
  name: string;
  analyze(photoName: string, subject: "car" | "home"): Promise<VisionResult>;
}

const CAR_SEGMENTS: VisionSegment[] = [
  { label: "front panel", note: "scuff", x: 8, y: 30, w: 34, h: 38, severity: "minor" },
  { label: "wheel — front", note: "curb rash", x: 52, y: 60, w: 22, h: 28, severity: "attention" },
  { label: "exterior", note: "clean", x: 40, y: 12, w: 52, h: 40, severity: "clean" },
  { label: "headlight", note: "clear, no haze", x: 14, y: 22, w: 14, h: 12, severity: "clean" },
];

const HOME_SEGMENTS: VisionSegment[] = [
  { label: "front exterior", note: "clean", x: 10, y: 14, w: 58, h: 54, severity: "clean" },
  { label: "roof line", note: "check shingles near ridge", x: 12, y: 4, w: 66, h: 14, severity: "minor" },
  { label: "entry", note: "welcoming, good light", x: 44, y: 44, w: 16, h: 32, severity: "clean" },
  { label: "driveway", note: "surface cracks", x: 58, y: 74, w: 34, h: 20, severity: "attention" },
];

// Stub output — deterministic canned segments so the overlay, grading, and
// lead flow can be built and demoed before SAM access exists. It does NOT
// look at the actual photo, and the result says stubbed:true so nothing
// downstream can pretend otherwise.
export class StubVisionProvider implements VisionProvider {
  name = "stub";
  async analyze(_photoName: string, subject: "car" | "home"): Promise<VisionResult> {
    const segments = subject === "car" ? CAR_SEGMENTS : HOME_SEGMENTS;
    const attention = segments.filter((s) => s.severity === "attention").length;
    const grade = attention > 1 ? "C" : attention === 1 ? "B" : "A";
    return {
      provider: this.name,
      stubbed: true,
      subject,
      segments,
      grade,
      summary:
        subject === "car"
          ? "Reads as a well-kept car with two things worth a closer look before pricing the trade-in."
          : "Reads as a well-kept home with a couple of exterior items worth noting for the viewing.",
    };
  }
}

export class SamVisionProvider implements VisionProvider {
  name = "sam-3.1";
  async analyze(): Promise<VisionResult> {
    // Real SAM 3.1 wiring lands Oct 26 IF Meta accepts the application.
    // It will POST the photo to the Meta Model API and map the returned
    // masks to VisionSegment boxes in % coordinates. Until then: throw.
    throw new Error("SamVisionProvider not wired yet — pending Meta hackathon API access (Oct 26).");
  }
}

export function getVisionProvider(): VisionProvider {
  return new StubVisionProvider();
}
