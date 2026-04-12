"use client";

import { useState, useEffect } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScoreBar } from "@/components/ScoreBar";
import { ScoreRing } from "@/components/ScoreRing";
import { ComparisonCard } from "@/components/ComparisonCard";
import { RoastResult, ComparisonResult } from "@/lib/types";
import { Change, CompetitorSnapshot } from "@/lib/changeDetector";

type View = "intel" | "analyses" | "new";

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
  snapshot: CompetitorSnapshot;
  score: { total_score: number; breakdown: Record<string, number>; flags: string[]; breakdown_flags: Record<string, string[]> };
  profile: { target_audience: string; positioning: string; strategy: string; opportunities: string };
  changes: Change[];
  aiInsight?: string;
  error?: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function scoreLabel(score: number) {
  if (score >= 7) return "text-emerald-700 bg-emerald-50";
  if (score >= 5) return "text-amber-700 bg-amber-50";
  return "text-red-600 bg-red-50";
}

function changeText(c: Change): string {
  if (c.type === "headline") return `Headline changed`;
  if (c.type === "cta_added") return `New CTA: "${c.value}"`;
  if (c.type === "cta_removed") return `CTA removed: "${c.value}"`;
  if (c.type === "social_proof") return c.added ? "Social proof added" : "Social proof removed";
  if (c.type === "pricing") return c.added ? "Pricing section appeared" : "Pricing section removed";
  if (c.type === "nav_added") return `New page: ${c.value}`;
  if (c.type === "nav_removed") return `Page removed: ${c.value}`;
  if (c.type === "client_added") return `New client: ${c.value}`;
  if (c.type === "client_removed") return `Client removed: ${c.value}`;
  return "";
}

export default function Dashboard() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const [isPro, setIsPro] = useState(false);
  const [proLoaded, setProLoaded] = useState(false);
  const [view, setView] = useState<View>("intel");

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
  const [scanning, setScanning] = useState(false);
  const [monitorResults, setMonitorResults] = useState<Record<string, MonitorResult>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("monitorResults") ?? "{}"); } catch { return {}; }
  });
  const [lastChecked, setLastChecked] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("lastChecked");
  });
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showFullProfile, setShowFullProfile] = useState<Record<string, boolean>>({});

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
      .then(d => {
        const r = d.roasts ?? [];
        setRoasts(r);
        if (r.length > 0) setExpanded(r[0].id);
        setRoastsLoading(false);
      });
  }, [isPro, user]);

  useEffect(() => {
    if (!isPro || !user) return;
    setCompetitorsLoading(true);
    fetch(`/api/competitors?userId=${user.id}`)
      .then(r => r.json())
      .then(d => { setCompetitors(d.competitors ?? []); setCompetitorsLoading(false); });
  }, [isPro, user]);

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
      const updated = [...competitors, data.competitor];
      setCompetitors(updated);
      setNewCompetitorUrl("");
      // Auto-scan immediately
      await runMonitoring(updated);
    } finally {
      setAddingCompetitor(false);
    }
  }

  async function removeCompetitor(id: string) {
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    setCompetitors(prev => prev.filter(c => c.id !== id));
    setMonitorResults(prev => {
      const next = { ...prev };
      delete next[id];
      try { localStorage.setItem("monitorResults", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function runMonitoring(competitorList?: Competitor[]) {
    if (!user) return;
    setScanning(true);
    try {
      const res = await fetch("/api/competitors/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      const results: MonitorResult[] = data.results ?? [];
      const map: Record<string, MonitorResult> = {};
      for (const r of results) map[r.competitorId] = r;
      setMonitorResults(map);
      setLastChecked(data.checkedAt);
      try {
        localStorage.setItem("monitorResults", JSON.stringify(map));
        localStorage.setItem("lastChecked", data.checkedAt);
      } catch {}
      // Auto-expand first result
      if (results.length > 0) setExpandedCard(results[0].competitorId);
    } finally {
      setScanning(false);
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
      fetch(`/api/roasts?userId=${user.id}`)
        .then(r => r.json())
        .then(d => {
          const r = d.roasts ?? [];
          setRoasts(r);
          if (r.length > 0) setExpanded(r[0].id);
        });
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <span className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  const BTN = "text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-40 flex items-center gap-2";
  const BTN_COLOR = { backgroundColor: "#92400e" };

  return (
    <div className="min-h-screen flex bg-white font-sans">

      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-gray-100 flex flex-col h-screen sticky top-0">
        <div className="px-5 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg">🍞</span>
            <span className="text-sm font-semibold text-gray-900">Roaster</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {([
            ["intel",     "Competitors"],
            ["analyses",  "My Pages"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                view === v
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => { setView("new"); setAnalysisResult(null); setAnalysisUrl(""); setAnalysisError(""); setNewComparison(null); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left ${
              view === "new"
                ? "bg-gray-100 text-gray-900 font-medium"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            + New Analysis
          </button>
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-2.5">
          <UserButton />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{user?.firstName ?? user?.primaryEmailAddress?.emailAddress}</p>
            <span className="text-[11px] text-amber-700 font-semibold">Pro</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">

          {/* ── Market Intel ── */}
          {view === "intel" && (
            <div className="space-y-8">

              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-base font-semibold text-gray-900">Competitors</h1>
                  <p className="text-sm text-gray-400 mt-0.5">Track what your competitors change on their site</p>
                </div>
                {competitors.length > 0 && (
                  <button
                    onClick={() => runMonitoring()}
                    disabled={scanning}
                    className={BTN}
                    style={BTN_COLOR}
                  >
                    {scanning ? (
                      <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Scanning</>
                    ) : "Scan all"}
                  </button>
                )}
              </div>

              {/* Add competitor */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompetitorUrl}
                  onChange={e => setNewCompetitorUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !addingCompetitor && addCompetitor()}
                  placeholder="https://competitor.com"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400 transition-colors"
                />
                <button
                  onClick={addCompetitor}
                  disabled={addingCompetitor || !newCompetitorUrl.trim()}
                  className={BTN}
                  style={BTN_COLOR}
                >
                  {addingCompetitor ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Adding...</>
                  ) : "Add"}
                </button>
              </div>

              {/* Empty state */}
              {!competitorsLoading && competitors.length === 0 && (
                <div className="border border-dashed border-gray-200 rounded-xl p-10 text-center">
                  <p className="text-sm font-medium text-gray-700 mb-1">No competitors yet</p>
                  <p className="text-sm text-gray-400">Add a competitor URL above — we'll scan their page and track every change from there.</p>
                </div>
              )}

              {/* Scanning skeleton */}
              {scanning && competitors.length > 0 && Object.keys(monitorResults).length === 0 && (
                <div className="space-y-3">
                  {competitors.map(c => (
                    <div key={c.id} className="border border-gray-100 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-gray-900">{c.hostname}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin inline-block" />
                          Scanning...
                        </span>
                      </div>
                      <div className="space-y-2.5 animate-pulse">
                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                        <div className="h-3 bg-gray-100 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Competitor cards */}
              {competitors.length > 0 && Object.keys(monitorResults).length > 0 && (
                <div className="space-y-3">
                  {competitors.map(competitor => {
                    const result = monitorResults[competitor.id];
                    const isOpen = expandedCard === competitor.id;

                    return (
                      <div key={competitor.id} className="border border-gray-100 rounded-xl overflow-hidden">

                        {/* Card header — always visible */}
                        <button
                          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                          onClick={() => setExpandedCard(isOpen ? null : competitor.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900">{competitor.hostname}</span>
                          </div>
                          {result && !result.error && result.score.total_score > 0 && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums ${scoreLabel(result.score.total_score)}`}>
                              {result.score.total_score}/10
                            </span>
                          )}
                          {result?.error && (
                            <span className="text-xs text-red-500">Failed to scan</span>
                          )}
                          {!result && (
                            <span className="text-xs text-gray-400">Not scanned yet</span>
                          )}
                          {/* Change indicator */}
                          {result && !result.error && result.changes.length > 0 && (
                            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                              {result.changes.length} change{result.changes.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); removeCompetitor(competitor.id); }}
                            className="text-gray-300 hover:text-red-400 transition-colors text-xs ml-1 p-1"
                          >
                            ✕
                          </button>
                          <span className="text-gray-300 text-xs">{isOpen ? "▲" : "▼"}</span>
                        </button>

                        {/* Expanded content */}
                        {isOpen && result && !result.error && (() => {
                          const weakSignals = Object.values(result.score.breakdown_flags ?? {}).flat().slice(0, 4);
                          const profileOpen = showFullProfile[competitor.id];
                          return (
                            <div className="px-5 pb-5 pt-4 border-t border-gray-50 space-y-5">

                              {/* Hero: opportunity */}
                              {result.profile.opportunities && (
                                <div className="border-l-2 border-amber-400 bg-amber-50 rounded-r-lg px-4 py-3">
                                  <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Your opening</p>
                                  <p className="text-sm text-gray-900 leading-relaxed">{result.profile.opportunities}</p>
                                </div>
                              )}

                              {/* Weak signals */}
                              {weakSignals.length > 0 && (
                                <div>
                                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Their weak spots</p>
                                  <ul className="space-y-1">
                                    {weakSignals.map((flag, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                        <span className="text-gray-300 mt-0.5 shrink-0">·</span>
                                        {flag}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Changes feed */}
                              <div>
                                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Changes</p>
                                {result.changes.length > 0 ? (
                                  <div className="space-y-3">
                                    <ul className="space-y-1">
                                      {result.changes.map((c, i) => (
                                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                          <span className="text-gray-300 mt-0.5 shrink-0">·</span>
                                          <span>
                                            {changeText(c)}
                                            {c.type === "headline" && c.from && (
                                              <span className="text-gray-400 ml-1.5 text-xs">"{c.from}" → "{c.to}"</span>
                                            )}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                    {result.aiInsight && (
                                      <div className="bg-gray-50 rounded-lg px-3.5 py-3">
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">What this means</p>
                                        <p className="text-sm text-gray-700">{result.aiInsight}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-400">
                                    {result.isFirstRun
                                      ? "Tracking started — changes will surface here as they happen"
                                      : "Stable — no major changes since last scan"}
                                  </p>
                                )}
                              </div>

                              {/* Full profile toggle */}
                              <div className="border-t border-gray-50 pt-3">
                                <button
                                  onClick={() => setShowFullProfile(prev => ({ ...prev, [competitor.id]: !prev[competitor.id] }))}
                                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  {profileOpen ? "▲ Hide full profile" : "▼ Show full profile"}
                                </button>
                                {profileOpen && (
                                  <div className="mt-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                      {result.profile.target_audience && (
                                        <div>
                                          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-0.5">Target</p>
                                          <p className="text-sm text-gray-700">{result.profile.target_audience}</p>
                                        </div>
                                      )}
                                      {result.profile.positioning && (
                                        <div>
                                          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-0.5">Positioning</p>
                                          <p className="text-sm text-gray-700">{result.profile.positioning}</p>
                                        </div>
                                      )}
                                      {result.profile.strategy && (
                                        <div className="col-span-2">
                                          <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-0.5">Strategy signal</p>
                                          <p className="text-sm text-gray-700">{result.profile.strategy}</p>
                                        </div>
                                      )}
                                    </div>
                                    {result.snapshot.headline && (
                                      <div>
                                        <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-0.5">Current headline</p>
                                        <p className="text-sm text-gray-600 italic">"{result.snapshot.headline}"</p>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                                      <span>{result.snapshot.has_pricing ? "✓ Pricing visible" : "✗ No pricing"}</span>
                                      <span>{result.snapshot.has_social_proof ? "✓ Social proof" : "✗ No social proof"}</span>
                                      {result.snapshot.ctas.length > 0 && <span>{result.snapshot.ctas.length} CTA{result.snapshot.ctas.length !== 1 ? "s" : ""}</span>}
                                    </div>
                                    {result.snapshot.client_list && result.snapshot.client_list.length > 0 && (
                                      <div>
                                        <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">Known clients</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {result.snapshot.client_list.map((client, i) => (
                                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">{client}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                            </div>
                          );
                        })()}

                        {/* Error state */}
                        {isOpen && result?.error && (
                          <div className="px-5 pb-5 pt-1 border-t border-gray-50">
                            <p className="text-sm text-red-500">{result.error}</p>
                          </div>
                        )}

                        {/* Not scanned state */}
                        {isOpen && !result && (
                          <div className="px-5 pb-5 pt-1 border-t border-gray-50">
                            <button
                              onClick={() => runMonitoring()}
                              disabled={scanning}
                              className={`${BTN} mt-2`}
                              style={BTN_COLOR}
                            >
                              Scan now
                            </button>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}

              {/* Competitor list without results */}
              {competitors.length > 0 && Object.keys(monitorResults).length === 0 && !scanning && (
                <div className="space-y-2">
                  {competitors.map(c => (
                    <div key={c.id} className="border border-gray-100 rounded-xl px-5 py-4 flex items-center gap-3">
                      <span className="flex-1 text-sm font-medium text-gray-900">{c.hostname}</span>
                      <span className="text-xs text-gray-400">Added {timeAgo(c.created_at)}</span>
                      <button
                        onClick={() => removeCompetitor(c.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-xs p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="pt-2">
                    <button
                      onClick={() => runMonitoring()}
                      disabled={scanning}
                      className={BTN}
                      style={BTN_COLOR}
                    >
                      Scan competitors
                    </button>
                  </div>
                </div>
              )}

              {lastChecked && (
                <p className="text-xs text-gray-300">Last scanned {new Date(lastChecked).toLocaleString()}</p>
              )}

            </div>
          )}

          {/* ── My Pages ── */}
          {view === "analyses" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-base font-semibold text-gray-900">My Pages</h1>
                  <p className="text-sm text-gray-400 mt-0.5">{roasts.length} page{roasts.length !== 1 ? "s" : ""} analysed</p>
                </div>
                <button
                  onClick={() => { setView("new"); setAnalysisResult(null); setAnalysisUrl(""); setAnalysisError(""); setNewComparison(null); }}
                  className={BTN}
                  style={BTN_COLOR}
                >
                  + New Analysis
                </button>
              </div>

              {roastsLoading ? (
                <div className="flex justify-center py-16">
                  <span className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                </div>
              ) : roasts.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-12 text-center">
                  <p className="text-sm font-medium text-gray-700 mb-1">No analyses yet</p>
                  <p className="text-sm text-gray-400 mb-6">Analyse your first landing page to get a full breakdown.</p>
                  <button
                    onClick={() => { setView("new"); setAnalysisResult(null); setAnalysisUrl(""); setAnalysisError(""); setNewComparison(null); }}
                    className={BTN + " mx-auto"}
                    style={BTN_COLOR}
                  >
                    Analyse a page
                  </button>
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {roasts.map((roast) => (
                    <div key={roast.id}>
                      <button
                        onClick={() => setExpanded(expanded === roast.id ? null : roast.id)}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{roast.hostname}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{timeAgo(roast.created_at)}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums ${scoreLabel(roast.score)}`}>
                          {roast.score}/10
                        </span>
                        <span className="text-gray-300 text-xs">{expanded === roast.id ? "▲" : "▼"}</span>
                      </button>

                      {expanded === roast.id && (
                        <div className="px-5 pb-6 pt-4 bg-gray-50 border-t border-gray-100 space-y-6">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <p className="text-xs text-gray-400 uppercase tracking-widest">Score breakdown</p>
                              {(["clarity", "value", "structure", "conversion", "trust"] as const).map((key) => (
                                <ScoreBar key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} description="" score={roast.result.score.breakdown[key]} />
                              ))}
                            </div>
                            <div className="space-y-3">
                              <p className="text-xs text-gray-400 uppercase tracking-widest">Key issues</p>
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
                            <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Competitor analysis</p>
                            {comparisons[roast.id] ? (
                              <ComparisonCard yourScore={roast.result.score} comparison={comparisons[roast.id]} />
                            ) : (
                              <div className="space-y-2">
                                {compareErrors[roast.id] && <p className="text-xs text-red-500">{compareErrors[roast.id]}</p>}
                                <button
                                  onClick={() => runComparison(roast)}
                                  disabled={comparing === roast.id}
                                  className={BTN}
                                  style={BTN_COLOR}
                                >
                                  {comparing === roast.id ? (
                                    <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Finding competitors...</>
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

          {/* ── New Analysis ── */}
          {view === "new" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-base font-semibold text-gray-900">New Analysis</h1>
                <p className="text-sm text-gray-400 mt-0.5">Get a full breakdown of any landing page</p>
              </div>

              {!analysisResult && (
                <div className="border border-gray-100 rounded-xl p-6 space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={analysisUrl}
                      onChange={e => setAnalysisUrl(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !analysisLoading && runAnalysis()}
                      placeholder="https://yourpage.com"
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-400 transition-colors"
                    />
                    <button
                      onClick={runAnalysis}
                      disabled={analysisLoading || !analysisUrl.trim()}
                      className={BTN}
                      style={BTN_COLOR}
                    >
                      {analysisLoading ? (
                        <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analysing...</>
                      ) : "Analyse"}
                    </button>
                  </div>
                  {analysisError && <p className="text-sm text-red-500">{analysisError}</p>}
                </div>
              )}

              {analysisResult && (
                <div className="space-y-4">
                  <div className="border border-gray-100 rounded-xl p-8 flex flex-col items-center gap-3">
                    <ScoreRing score={analysisResult.score.total_score} />
                    {analysisResult.score.flags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {analysisResult.score.flags.map((flag, i) => (
                          <span key={i} className="px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-100 rounded-full">{flag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border border-gray-100 rounded-xl p-6 space-y-4">
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Score breakdown</p>
                    <div className="space-y-4">
                      {(["clarity", "value", "structure", "conversion", "trust"] as const).map(key => (
                        <ScoreBar key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} description="" score={analysisResult.score.breakdown[key]} />
                      ))}
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-xl p-6 space-y-4">
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Key issues</p>
                    <ul className="space-y-3">
                      {analysisResult.llm.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                          <span className="text-sm text-gray-700 leading-relaxed">{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-gray-100 rounded-xl p-6 space-y-4">
                    <p className="text-xs text-gray-400 uppercase tracking-widest">How to fix it</p>
                    <ul className="space-y-3">
                      {analysisResult.llm.improvements.map((imp, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xs font-bold">✓</span>
                          <span className="text-sm text-gray-700 leading-relaxed">{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-gray-100 rounded-xl p-6 space-y-4">
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Competitor analysis</p>
                    {newComparison ? (
                      <ComparisonCard yourScore={analysisResult.score} comparison={newComparison} />
                    ) : (
                      <div className="space-y-2">
                        {newCompareError && <p className="text-xs text-red-500">{newCompareError}</p>}
                        <button
                          onClick={runNewComparison}
                          disabled={newComparing}
                          className={BTN}
                          style={BTN_COLOR}
                        >
                          {newComparing ? (
                            <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Finding competitors...</>
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

        </div>
      </main>
    </div>
  );
}
