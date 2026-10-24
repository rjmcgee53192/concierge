"use client";

import type { VisionResult } from "@/lib/lead";

// The photo moment. Boxes draw themselves in sequence (CSS animation with a
// per-box delay) so a judge watching the demo sees the "reading" happen.
// NOTE: in v0 the segments come from StubVisionProvider — the overlay is the
// real product experience, the underlying analysis is stubbed until SAM 3.1
// is wired on Oct 26. See lib/vision.ts.
export default function PhotoVision({
  imageUrl,
  result,
}: {
  imageUrl: string;
  result: VisionResult;
}) {
  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-xl border border-[#c9a86a]/30">
        {/* plain img: the source is a local object URL, next/image adds nothing here */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Buyer photo being read by Concierge" className="block max-h-80 w-full object-cover" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {result.segments.map((s, i) => (
            <rect
              key={s.label}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              className="seg-box"
              style={{ animationDelay: `${i * 0.45}s` }}
              fill={s.severity === "clean" ? "rgba(120,200,140,0.10)" : s.severity === "minor" ? "rgba(201,168,106,0.12)" : "rgba(220,90,80,0.14)"}
              stroke={s.severity === "clean" ? "#7dc98f" : s.severity === "minor" ? "#c9a86a" : "#e0685e"}
              strokeWidth="0.7"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold tracking-wide text-[#e8cf9a]">
          Condition grade {result.grade}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {result.segments.map((s, i) => (
          <li
            key={s.label}
            className="seg-label flex items-baseline gap-2 text-sm text-zinc-300"
            style={{ animationDelay: `${i * 0.45 + 0.15}s` }}
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: s.severity === "clean" ? "#7dc98f" : s.severity === "minor" ? "#c9a86a" : "#e0685e" }}
            />
            <span className="font-medium text-zinc-100">{s.label}</span>
            <span className="text-zinc-400">— {s.note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-zinc-400">{result.summary}</p>
    </div>
  );
}
