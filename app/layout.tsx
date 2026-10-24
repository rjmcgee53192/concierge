import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Concierge — the AI receptionist that can see",
  description:
    "Concierge qualifies buyers for small luxury businesses from conversation and photos, and turns them into booked appointments in a lead pipeline.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[#0c0b09] text-zinc-100">
        <header className="border-b border-white/[0.07]">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Concierge <span className="text-[#c9a86a]">·</span>{" "}
              <span className="hidden text-sm font-normal text-zinc-400 sm:inline">the AI receptionist that can see</span>
            </Link>
            <nav className="flex gap-5 text-sm text-zinc-300">
              <Link href="/" className="hover:text-[#e8cf9a]">Intake</Link>
              <Link href="/pipeline" className="hover:text-[#e8cf9a]">Pipeline</Link>
              <Link href="/benchmark" className="hover:text-[#e8cf9a]">Benchmark</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/[0.07] py-6">
          <p className="mx-auto w-full max-w-6xl px-5 text-xs text-zinc-500">
            Concierge v0 — built for the fall 2026 hackathon circuit. Vision and model layers run on
            stubs behind provider interfaces until hackathon API access lands; nothing here is a live AI call yet.
          </p>
        </footer>
      </body>
    </html>
  );
}
