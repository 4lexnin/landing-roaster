"use client";

import { useState, useEffect } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScoreBar } from "@/components/ScoreBar";
import { ScoreRing } from "@/components/ScoreRing";
import { ComparisonCard } from "@/components/ComparisonCard";
import { RoastResult, ComparisonResult } from "@/lib/types";
import { Change } from "@/lib/changeDetector";

type View = "analyses" | "intel" | "leaderboard" | "new";

interface SavedRoast {
  id: string;
  url: string;
  hostname: string;
  score: number;
  result: RoastResult;
  created_at: string;
}

interface Competitor {
  id: string;
  url: string;
  hostname: string;
  created_at: string;
}

interface MonitorResult {
  competitorId: string;
  hostname: string;
  url: string;
  isFirstRun: boolean;
  waybackDate?: string;
  changes: Change[];
  aiInsight?: string;
  error?: string;
}

interface PersistedChange {
  id: string;
  competitor_id: string;
  change_type: Change["type"];
  from_value: string | null;
  to_value: string | null;
  value: string | null;
  added: boolean | null;
  detected_at: string;
  competitors: { hostname: string; url: string };
}

function scoreColor(score: number) {
  if (score >= 7) return "text-green-600";
  if (score >= 5) return "text-amber-600";
  return "text-red-500";
}

function scoreBg(score: number) {
  if (score >= 7) return "bg-green-50 text-green-700 border-green-100";
  if (score >= 5) return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-red-50 text-red-600 border-red-100";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const changeLabels: Record<Change["type"], { icon: string; label: (c: Change) => string; bg: string; text: string }> = {
  headline:      { icon: "✏️", label: (c) => `Headline changed`, bg: "bg-blue-50 border-blue-100", text: "text-blue-700" },
  cta_added:     { icon: "✅", label: (c) => `New CTA: "${c.value}"`, bg: "bg-green-50 border-green-100", text: "text-green-700" },
  cta_removed:   { icon: "❌", label: (c) => `CTA removed: "${c.value}"`, bg: "bg-red-50 border-red-100", text: "text-red-700" },
  social_proof:  { icon: "👥", label: (c) => c.added ? "Social proof added" : "Social proof removed", bg: "bg-purple-50 border-purple-100", text: "text-purple-700" },
  pricing:       { icon: "💰", label: (c) => c.added ? "Pricing section appeared" : "Pricing section removed", bg: "bg-amber-50 border-amber-100", text: "text-amber-700" },
  nav_added:     { icon: "🔗", label: (c) => `New page: ${c.value}`, bg: "bg-teal-50 border-teal-100", text: "text-teal-700" },
  nav_removed:   { icon: "🗑️", label: (c) => `Page removed: ${c.value}`, bg: "bg-gray-50 border-gray-200", text: "text-gray-600" },
};

export default function Dashboard() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const [isPro, setIsPro] = useState(false);
  const [proLoaded, setProLoaded] = useState(false);
  const [view, setView] = useState<View>("analyses");

  // Analyses state
  const [roasts, setRoasts] = useState<SavedRoast[]>([]);
  const [roastsLoading, setRoastsLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comparisons, setComparisons] = useState<Record<string, ComparisonResult>>({});
  const [comparing, setComparing] = useState<string | null>(null);
  const [compareErrors, setCompareErrors] = useState<Record<string, string>>({});

  // New analysis state
  const [analysisUrl, setAnalysisUrl] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<RoastResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [newComparison, setNewComparison] = useState<ComparisonResult | null>(null);
  const [newComparing, setNewComparing] = useState(false);
  const [newCompareError, setNewCompareError] = useState("");

  // Market Intel state
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [newCompetitorUrl, setNewCompetitorUrl] = useState("");
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [monitorResults, setMonitorResults] = useState<MonitorResult[] | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [changeHistory, setChangeHistory] = useState<PersistedChange[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/"); return; }
    fetch(`/api/subscription?userId=${user.id}`)
      .then(r => r.json())
      .then(d => {
        setIsPro(d.active);
        setProLoaded(true);
        if (!d.active) router.push("/");
      });
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (!isPro || !user) return;
    setRoastsLoading(true);
    fetch(`/api/roasts?userId=${user.id}`)
      .then(r => r.json())
      .then(d => { setRoasts(d.roasts ?? []); setRoastsLoading(false); });
  }, [isPro, user]);

  useEffect(() => {
    if (!isPro || !user || view !== "intel") return;
    setCompetitorsLoading(true);
    fetch(`/api/competitors?userId=${user.id}`)
      .then(r => r.json())
      .then(d => { setCompetitors(d.competitors ?? []); setCompetitorsLoading(false); });
    setHistoryLoading(true);
    fetch(`/api/competitors/changes?userId=${user.id}`)
      .then(r => r.json())
      .then(d => { setChangeHistory(d.changes ?? []); setHistoryLoading(false); });
  }, [isPro, user, view]);

  async function addCompetitor() {
    if (!newCompetitorUrl.trim() || !user) return;
    setAddingCompetitor(true);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, url: newCompetitorUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCompetitors(prev => [...prev, data.competitor]);
      setNewCompetitorUrl("");
    } finally {
      setAddingCompetitor(false);
    }
  }

  async function removeCompetitor(id: string) {
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    setCompetitors(prev => prev.filter(c => c.id !== id));
  }

  async function runMonitoring() {
    if (!user) return;
    setMonitoring(true);
    setMonitorResults(null);
    try {
      const res = await fetch("/api/competitors/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      setMonitorResults(data.results ?? []);
      setLastChecked(data.checkedAt);
      // Refresh persisted history
      const historyRes = await fetch(`/api/competitors/changes?userId=${user.id}`);
      const historyData = await historyRes.json();
      setChangeHistory(historyData.changes ?? []);
    } finally {
      setMonitoring(false);
    }
  }

  async function runComparison(roast: SavedRoast) {
    setComparing(roast.id);
    setCompareErrors(prev => ({ ...prev, [roast.id]: "" }));
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.id, scraped: roast.result.scraped, yourScore: roast.score }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setComparisons(prev => ({ ...prev, [roast.id]: data }));
    } catch (err) {
      setCompareErrors(prev => ({ ...prev, [roast.id]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setComparing(null);
    }
  }

  async function runAnalysis() {
    if (!analysisUrl.trim() || !user) return;
    setAnalysisLoading(true);
    setAnalysisError("");
    setAnalysisResult(null);
    setNewComparison(null);
    setNewCompareError("");
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: analysisUrl.trim(), userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setAnalysisResult(data);
      // Refresh history list
      fetch(`/api/roasts?userId=${user.id}`)
        .then(r => r.json())
        .then(d => setRoasts(d.roasts ?? []));
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to analyse");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function runNewComparison() {
    if (!analysisResult || !user) return;
    setNewComparing(true);
    setNewCompareError("");
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, scraped: analysisResult.scraped, yourScore: analysisResult.score.total_score }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setNewComparison(data);
    } catch (err) {
      setNewCompareError(err instanceof Error ? err.message : "Failed");
    } finally {
      setNewComparing(false);
    }
  }

  if (!isLoaded || !proLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🍞</span>
            <span className="text-sm font-semibold text-gray-900">Roaster</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {(["analyses", "intel", "leaderboard"] as const).map((v) => {
            const labels: Record<string, [string, string]> = { analyses: ["📋", "My Analysis"], intel: ["🔍", "Market Intel"], leaderboard: ["🏆", "Leaderboard"] };
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  view === v ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                <span className="text-base">{labels[v][0]}</span>
                {labels[v][1]}
              </button>
            );
          })}
          <button
            onClick={() => { setView("new"); setAnalysisResult(null); setAnalysisUrl(""); setAnalysisError(""); setNewComparison(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
              view === "new" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <span className="text-base">🔥</span>
            New Analysis
          </button>
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3">
          <UserButton />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{user?.firstName ?? user?.primaryEmailAddress?.emailAddress}</p>
            <span className="text-xs text-amber-600 font-semibold">Pro</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">

          {/* My Analysis */}
          {view === "analyses" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">My Analysis</h1>
                  <p className="text-sm text-gray-400 mt-0.5">{roasts.length} page{roasts.length !== 1 ? "s" : ""} analysed</p>
                </div>
                <button
                  onClick={() => { setView("new"); setAnalysisResult(null); setAnalysisUrl(""); setAnalysisError(""); setNewComparison(null); }}
                  className="text-sm font-medium px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: "#92400e" }}
                >
                  + New Analysis
                </button>
              </div>

              {roastsLoading ? (
                <div className="flex justify-center py-16">
                  <span className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                </div>
              ) : roasts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <p className="text-2xl mb-3">🍞</p>
                  <p className="text-sm font-medium text-gray-700 mb-1">No analyses yet</p>
                  <p className="text-sm text-gray-400 mb-6">Analyse your first landing page to get started.</p>
                  <button
                    onClick={() => { setView("new"); setAnalysisResult(null); setAnalysisUrl(""); setAnalysisError(""); setNewComparison(null); }}
                    className="text-sm font-medium px-5 py-2.5 rounded-lg text-white inline-block"
                    style={{ backgroundColor: "#92400e" }}
                  >
                    Analyse a page
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                  {roasts.map((roast) => (
                    <div key={roast.id}>
                      <button
                        onClick={() => setExpanded(expanded === roast.id ? null : roast.id)}
                        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{roast.hostname}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{roast.url}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${scoreBg(roast.score)}`}>
                          {roast.score}/10
                        </span>
                        <span className="text-xs text-gray-400 w-16 text-right">{timeAgo(roast.created_at)}</span>
                        <span className="text-gray-300 text-xs ml-1">{expanded === roast.id ? "▲" : "▼"}</span>
                      </button>

                      {expanded === roast.id && (
                        <div className="px-6 pb-6 pt-4 bg-gray-50 border-t border-gray-100 space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Score breakdown</p>
                              {(["clarity", "value", "structure", "conversion", "trust"] as const).map((key) => (
                                <ScoreBar key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} description="" score={roast.result.score.breakdown[key]} />
                              ))}
                            </div>
                            <div className="space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Key issues</p>
                              <ul className="space-y-2">
                                {roast.result.llm?.weaknesses?.map((w, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                    <span className="mt-0.5 w-4 h-4 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="border-t border-gray-200 pt-5">
                            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Competitor analysis</p>
                            {comparisons[roast.id] ? (
                              <ComparisonCard yourScore={roast.result.score} comparison={comparisons[roast.id]} />
                            ) : (
                              <div className="space-y-2">
                                {compareErrors[roast.id] && <p className="text-xs text-red-500">{compareErrors[roast.id]}</p>}
                                <button
                                  onClick={() => runComparison(roast)}
                                  disabled={comparing === roast.id}
                                  className="text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-50"
                                  style={{ backgroundColor: "#92400e" }}
                                >
                                  {comparing === roast.id ? (
                                    <span className="flex items-center gap-2">
                                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      Finding competitors...
                                    </span>
                                  ) : "Run competitor analysis"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Market Intel */}
          {view === "intel" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Market Intel</h1>
                  <p className="text-sm text-gray-400 mt-0.5">Track what your competitors change on their site</p>
                </div>
                {competitors.length > 0 && (
                  <button
                    onClick={runMonitoring}
                    disabled={monitoring}
                    className="text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-50 flex items-center gap-2"
                    style={{ backgroundColor: "#92400e" }}
                  >
                    {monitoring ? (
                      <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scanning...</>
                    ) : "Run monitoring"}
                  </button>
                )}
              </div>

              {/* Add competitor */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Add competitor</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCompetitorUrl}
                    onChange={e => setNewCompetitorUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCompetitor()}
                    placeholder="https://competitor.com"
                    className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 transition-colors"
                  />
                  <button
                    onClick={addCompetitor}
                    disabled={addingCompetitor || !newCompetitorUrl.trim()}
                    className="text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-40"
                    style={{ backgroundColor: "#92400e" }}
                  >
                    {addingCompetitor ? "Adding..." : "Add"}
                  </button>
                </div>

                {competitorsLoading ? (
                  <div className="flex justify-center py-4">
                    <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                  </div>
                ) : competitors.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {competitors.map(c => (
                      <li key={c.id} className="flex items-center gap-3 text-sm">
                        <span className="flex-1 text-gray-700 font-medium">{c.hostname}</span>
                        <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                        <button onClick={() => removeCompetitor(c.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors">✕</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-gray-400">No competitors added yet.</p>
                )}
              </div>

              {/* Change history */}
              {(historyLoading || changeHistory.length > 0) && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Change history</p>
                  {historyLoading ? (
                    <div className="flex justify-center py-8">
                      <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                      {changeHistory.map((c) => {
                        const changeAsChange: Change = {
                          type: c.change_type,
                          from: c.from_value ?? undefined,
                          to: c.to_value ?? undefined,
                          value: c.value ?? undefined,
                          added: c.added ?? undefined,
                        };
                        const cfg = changeLabels[c.change_type];
                        return (
                          <div key={c.id} className="flex items-start gap-3 px-5 py-3.5">
                            <span className="text-sm mt-0.5">{cfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-500">{c.competitors?.hostname}</span>
                                <span className="text-xs text-gray-300">·</span>
                                <span className="text-xs text-gray-400">{timeAgo(c.detected_at)}</span>
                              </div>
                              <p className={`text-sm font-medium mt-0.5 ${cfg.text}`}>{cfg.label(changeAsChange)}</p>
                              {c.change_type === "headline" && (
                                <div className="text-xs mt-1 space-y-0.5">
                                  <p className="text-gray-400 line-through">{c.from_value}</p>
                                  <p className="text-gray-700 font-medium">{c.to_value}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Monitor results */}
              {monitorResults && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      Last scan — {lastChecked ? new Date(lastChecked).toLocaleString() : ""}
                    </p>
                    <span className="text-xs text-gray-400">{monitorResults.reduce((acc, r) => acc + r.changes.length, 0)} changes detected</span>
                  </div>

                  {monitorResults.map(result => (
                    <div key={result.competitorId} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">{result.hostname}</p>
                        {result.isFirstRun && result.changes.length > 0 ? (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full font-medium">{result.changes.length} change{result.changes.length !== 1 ? "s" : ""} (last 30d)</span>
                        ) : result.isFirstRun ? (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-medium">Baseline saved</span>
                        ) : result.error ? (
                          <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full font-medium">Failed to scan</span>
                        ) : result.changes.length === 0 ? (
                          <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2.5 py-1 rounded-full font-medium">No changes</span>
                        ) : (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full font-medium">{result.changes.length} change{result.changes.length !== 1 ? "s" : ""}</span>
                        )}
                      </div>

                      {result.isFirstRun && !result.waybackDate && (
                        <p className="text-sm text-gray-500">Baseline saved. Run monitoring again to detect future changes.</p>
                      )}

                      {result.isFirstRun && result.waybackDate && result.changes.length === 0 && (
                        <p className="text-sm text-gray-500">Compared against a 30-day-old snapshot — no changes found.</p>
                      )}

                      {result.error && <p className="text-sm text-red-500">{result.error}</p>}

                      {result.changes.length > 0 && (
                        <div className="space-y-2">
                          {result.isFirstRun && result.waybackDate && (
                            <p className="text-xs text-gray-400 mb-1">
                              Changes detected vs. snapshot from {new Date(
                                result.waybackDate.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3T$4:$5:$6")
                              ).toLocaleDateString()}
                            </p>
                          )}
                          {result.changes.map((change, i) => {
                            const cfg = changeLabels[change.type];
                            return (
                              <div key={i} className={`rounded-xl border p-3.5 ${cfg.bg}`}>
                                <div className="flex items-start gap-2">
                                  <span className="text-sm">{cfg.icon}</span>
                                  <div className="space-y-1">
                                    <p className={`text-sm font-medium ${cfg.text}`}>{cfg.label(change)}</p>
                                    {change.type === "headline" && (
                                      <div className="text-xs space-y-0.5">
                                        <p className="text-gray-400 line-through">{change.from}</p>
                                        <p className="text-gray-700 font-medium">{change.to}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {result.aiInsight && (
                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3.5 flex items-start gap-2">
                              <span className="text-sm">🧠</span>
                              <p className="text-sm text-amber-800">{result.aiInsight}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Analysis */}
          {view === "new" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">New Analysis</h1>
                <p className="text-sm text-gray-400 mt-0.5">Enter your landing page URL to get a full breakdown</p>
              </div>

              {!analysisResult && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={analysisUrl}
                      onChange={e => setAnalysisUrl(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !analysisLoading && runAnalysis()}
                      placeholder="https://yourpage.com"
                      className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-400 transition-colors"
                    />
                    <button
                      onClick={runAnalysis}
                      disabled={analysisLoading || !analysisUrl.trim()}
                      className="text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-40 flex items-center gap-2"
                      style={{ backgroundColor: "#92400e" }}
                    >
                      {analysisLoading ? (
                        <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analysing...</>
                      ) : "Analyse"}
                    </button>
                  </div>
                  {analysisError && <p className="text-sm text-red-500">{analysisError}</p>}
                </div>
              )}

              {analysisResult && (
                <div className="space-y-5">
                  {/* Score */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-8 flex flex-col items-center gap-3">
                    <ScoreRing score={analysisResult.score.total_score} />
                    {analysisResult.score.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {analysisResult.score.flags.map((flag, i) => (
                          <span key={i} className="px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-100 rounded-full">{flag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score breakdown */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Score Breakdown</p>
                    <div className="space-y-4">
                      {(["clarity", "value", "structure", "conversion", "trust"] as const).map(key => (
                        <ScoreBar
                          key={key}
                          label={key.charAt(0).toUpperCase() + key.slice(1)}
                          description=""
                          score={analysisResult.score.breakdown[key]}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Key issues */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Key Issues</p>
                    <ul className="space-y-3">
                      {analysisResult.llm.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                          <span className="text-sm text-gray-700 leading-relaxed">{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* How to fix */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">How to Fix It</p>
                    <ul className="space-y-3">
                      {analysisResult.llm.improvements.map((imp, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xs font-bold">✓</span>
                          <span className="text-sm text-gray-700 leading-relaxed">{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Competitor analysis */}
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Competitor Analysis</p>
                    {newComparison ? (
                      <ComparisonCard yourScore={analysisResult.score} comparison={newComparison} />
                    ) : (
                      <div className="space-y-2">
                        {newCompareError && <p className="text-xs text-red-500">{newCompareError}</p>}
                        <button
                          onClick={runNewComparison}
                          disabled={newComparing}
                          className="text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-50 flex items-center gap-2"
                          style={{ backgroundColor: "#92400e" }}
                        >
                          {newComparing ? (
                            <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Finding competitors...</>
                          ) : "Run competitor analysis"}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => { setAnalysisResult(null); setAnalysisUrl(""); setNewComparison(null); setNewCompareError(""); }}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ← Analyse another page
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Leaderboard */}
          {view === "leaderboard" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Leaderboard</h1>
                <p className="text-sm text-gray-400 mt-0.5">Your pages ranked by score</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {roasts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-12">No analyses yet.</p>
                ) : (
                  [...roasts].sort((a, b) => b.score - a.score).map((roast, i) => (
                    <div key={roast.id} className="flex items-center gap-4 px-6 py-4">
                      <span className="text-xs font-bold text-gray-300 w-5 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{roast.hostname}</p>
                        <p className="text-xs text-gray-400">{timeAgo(roast.created_at)}</p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${scoreColor(roast.score)}`}>{roast.score}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
