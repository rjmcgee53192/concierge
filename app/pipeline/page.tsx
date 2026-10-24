import PipelineBoard from "@/components/PipelineBoard";

export const metadata = { title: "Pipeline — Concierge" };

export default function PipelinePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Lead pipeline</h1>
      <p className="mt-2 max-w-2xl text-zinc-400">
        Every intake lands here as a scored lead: what they want, what the photo showed,
        how ready they are — and the follow-up draft waiting for a human to send.
        Leads you create in the intake on this device show up here too.
      </p>
      <div className="mt-8">
        <PipelineBoard />
      </div>
    </div>
  );
}
