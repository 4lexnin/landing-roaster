"use client";

import { useState, useRef, useEffect } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { RoastResults } from "@/components/RoastResults";
import { RoastResult } from "@/lib/types";

type State = "idle" | "loading" | "done" | "error";
type Tab = "roast" | "leaderboard";

interface LeaderboardEntry {
  hostname: string;
  score: number;
}

async function fetchRoastCount(): Promise<number> {
  try {
    const res = await fetch("/api/counter", { cache: "no-store" });
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch("/api/leaderboard", { cache: "no-store" });
    const data = await res.json();
    return data.entries ?? [];
  } catch {
    return [];
  }
}

const STEPS = [
  "Scraping your page...",
  "Running heuristics...",
  "Scoring 5 categories...",
  "Generating roast...",
];

function scoreColor(score: number) {
  if (score >= 7) return "#16a34a";
  if (score >= 5) return "#d97706";
  return "#dc2626";
}

export default function Home() {
  const { isSignedIn, user } = useUser();
  const [tab, setTab] = useState<Tab>("roast");
  const [isPro, setIsPro] = useState(false);
  const [proActivating, setProActivating] = useState(false);
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<RoastResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [roastCount, setRoastCount] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const stepInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchRoastCount().then(setRoastCount);
    // Restore result after Clerk OAuth redirect
    const saved = sessionStorage.getItem("pendingRoastResult");
    if (saved) {
      try {
        setResult(JSON.parse(saved));
        setState("done");
        // keep in sessionStorage so it survives Stripe redirect too
      } catch { /* ignore */ }
    }
  }, []);

  // Fetch Pro status + handle post-Stripe upgrade
  useEffect(() => {
    if (!isSignedIn || !user) return;

    const params = new URLSearchParams(window.location.search);
    const justUpgraded = params.get("upgraded") === "1";

    if (justUpgraded) {
      // Remove query param from URL cleanly
      window.history.replaceState({}, "", "/");
      setProActivating(true);
      // Poll until webhook has activated the subscription (up to 10s)
      let attempts = 0;
      const poll = setInterval(() => {
        fetch(`/api/subscription?userId=${user.id}`)
          .then(r => r.json())
          .then(d => {
            if (d.active) {
              setIsPro(true);
              setProActivating(false);
              clearInterval(poll);
            } else if (++attempts >= 5) {
              setProActivating(false);
              clearInterval(poll);
            }
          });
      }, 2000);
      return () => clearInterval(poll);
    }

    // Normal subscription check
    fetch(`/api/subscription?userId=${user.id}`)
      .then(r => r.json())
      .then(d => setIsPro(d.active));

    // Auto-trigger Stripe checkout if user clicked "Unlock" before signing in
    const pending = sessionStorage.getItem("pendingCheckout");
    if (pending) {
      sessionStorage.removeItem("pendingCheckout");
      fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userEmail: user.primaryEmailAddress?.emailAddress }),
      })
        .then(r => r.json())
        .then(({ url: checkoutUrl }) => { if (checkoutUrl) window.location.href = checkoutUrl; });
    }
  }, [isSignedIn, user]);

  useEffect(() => {
    if (tab === "leaderboard" && leaderboard.length === 0) {
      setLeaderboardLoading(true);
      fetchLeaderboard().then((entries) => {
        setLeaderboard(entries);
        setLeaderboardLoading(false);
      });
    }
  }, [tab, leaderboard.length]);

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
        body: JSON.stringify({ url: url.trim(), userId: user?.id ?? null }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }

      setResult(data);
      setState("done");
      sessionStorage.setItem("pendingRoastResult", JSON.stringify(data));
      // Refresh leaderboard data on next open
      setLeaderboard([]);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#fafafa] font-sans">
      {/* Nav */}
      <div className="fixed top-0 right-0 p-4 z-50">
        {isSignedIn ? (
          <UserButton />
        ) : (
          <SignInButton mode="modal">
            <button className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              Sign in
            </button>
          </SignInButton>
        )}
      </div>

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

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTab("roast")}
              className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
                tab === "roast" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Roast a page
            </button>
            <button
              onClick={() => setTab("leaderboard")}
              className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
                tab === "leaderboard" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              🍞 Leaderboard
            </button>
          </div>

          {tab === "roast" && (
            <>
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
            </>
          )}

          {tab === "leaderboard" && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Top 10 pages roasted</h2>
                <span className="text-xs text-gray-400">Score / 10</span>
              </div>
              {leaderboardLoading ? (
                <div className="flex justify-center py-8">
                  <span className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No roasts yet — be the first!</p>
              ) : (
                <ul className="space-y-3">
                  {leaderboard.map((entry, i) => (
                    <li key={entry.hostname} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-300 w-5 text-right">{i + 1}</span>
                      <span className="flex-1 text-sm text-gray-700 truncate">{entry.hostname}</span>
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{ color: scoreColor(entry.score) }}
                      >
                        {entry.score.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      {state === "done" && result && tab === "roast" && (
        <div ref={resultsRef} className="px-4">
          <div className="max-w-2xl mx-auto border-t border-gray-100 mb-8" />
          <RoastResults
            result={result}
            isPro={isPro}
            proActivating={proActivating}
            onRoastAnother={() => {
              setState("idle");
              setResult(null);
              setUrl("");
              sessionStorage.removeItem("pendingRoastResult");
              sessionStorage.removeItem("pendingCheckout");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
    </main>
  );
}
