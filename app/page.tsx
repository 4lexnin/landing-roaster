"use client";

import { useState, useRef, useEffect } from "react";
import { RoastResults } from "@/components/RoastResults";
import { SharePopup } from "@/components/SharePopup";
import { RoastResult } from "@/lib/types";

type State = "idle" | "loading" | "done" | "error";

async function fetchRoastCount(): Promise<number> {
  try {
    const res = await fetch("/api/counter", { cache: "no-store" });
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

const STEPS = [
  "Scraping your page...",
  "Running heuristics...",
  "Scoring 5 categories...",
  "Generating roast...",
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<RoastResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [roastCount, setRoastCount] = useState<number | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const stepInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchRoastCount().then(setRoastCount);
  }, []);

  useEffect(() => {
    if (state === "loading") {
      setStepIndex(0);
      stepInterval.current = setInterval(() => {
        setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
      }, 3500);
    } else {
      if (stepInterval.current) clearInterval(stepInterval.current);
    }
    return () => {
      if (stepInterval.current) clearInterval(stepInterval.current);
    };
  }, [state]);

  async function handleRoast(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setState("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }

      setResult(data);
      setState("done");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#fafafa] font-sans">
      {/* Hero / Input */}
      <section className="flex flex-col items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-2xl space-y-10">
          {/* Wordmark */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-white uppercase tracking-widest rounded-full px-3 py-1" style={{ backgroundColor: "#d97706" }}>
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
              Free roast
            </div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
              Roast my landing page
            </h1>
            <p className="text-gray-500 text-base max-w-md mx-auto leading-relaxed">
              Get a brutally honest, AI-powered critique of your landing page in 30 seconds.
            </p>
          </div>

          {/* Input Form */}
          <form onSubmit={handleRoast} className="space-y-3">
            <div className="flex gap-2 bg-white border border-gray-200 rounded-xl p-1.5 shadow-sm focus-within:border-gray-400 transition-colors">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste your landing page URL"
                className="flex-1 bg-transparent text-base text-gray-900 placeholder-gray-400 px-3 py-2 outline-none"
                disabled={state === "loading"}
                autoFocus
              />
              <button
                type="submit"
                disabled={state === "loading" || !url.trim()}
                className="text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: "#92400e" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#78350f")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#92400e")}
              >
                {state === "loading" ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Roasting...
                  </span>
                ) : (
                  "Roast my page"
                )}
              </button>
            </div>
            {state === "error" && (
              <p className="text-xs text-red-500 text-center">{errorMsg}</p>
            )}
          </form>

          {/* Loading steps */}
          {state === "loading" && (
            <div className="flex flex-col items-center gap-2">
              {STEPS.map((step, i) => (
                <div
                  key={step}
                  className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                    i < stepIndex
                      ? "text-gray-300 line-through"
                      : i === stepIndex
                      ? "text-gray-700 font-medium"
                      : "text-gray-300"
                  }`}
                >
                  {i < stepIndex && <span>✓</span>}
                  {i === stepIndex && (
                    <span className="w-3 h-3 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                  )}
                  {i > stepIndex && <span className="w-3 h-3" />}
                  {step}
                </div>
              ))}
            </div>
          )}

          {/* Social proof hint */}
          {state !== "loading" && (
            <p className="text-center text-xs text-gray-400">
              No account needed
              {roastCount !== null && roastCount > 0 && (
                <> · <span className="text-gray-500 font-medium">{roastCount.toLocaleString()} pages roasted</span></>
              )}
              {" "}· Powered by GPT-4o mini
            </p>
          )}
        </div>
      </section>

      {/* Results */}
      {state === "done" && result && (
        <div ref={resultsRef} className="px-4">
          <div className="max-w-2xl mx-auto border-t border-gray-100 mb-8" />
          <RoastResults
            result={result}
            onRoastAnother={() => {
              setState("idle");
              setResult(null);
              setUrl("");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
          <SharePopup result={result} />
        </div>
      )}
    </main>
  );
}
