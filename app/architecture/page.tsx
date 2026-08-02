import type { Metadata } from "next";
import { ArchitectureExplorer } from "@/components/architecture-explorer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "System Architecture | Inside the Voice Agent",
  description: "A component-by-component walkthrough of cascaded and native speech-to-speech voice agent execution.",
};

export default function ArchitecturePage() {
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl">
        <SiteHeader />
        <section className="pb-10 pt-12 sm:pt-16">
          <p className="text-sm font-medium text-blue-700">Architecture reference</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">How the voice agent executes</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">Follow audio from the browser through every processing boundary, inspect the technology used at each step, and present the Python equivalent one component at a time.</p>
        </section>
        <ArchitectureExplorer />
        <footer className="py-8 text-center text-xs text-slate-400">Inside the Voice Agent · Architecture reference</footer>
      </div>
    </main>
  );
}
