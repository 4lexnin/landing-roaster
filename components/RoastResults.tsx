"use client";

import { RoastResult } from "@/lib/types";
import { ScoreRing } from "./ScoreRing";
import { ScoreBar } from "./ScoreBar";
import { ShareBar } from "./ShareBar";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";

interface Props {
  result: RoastResult;
  onRoastAnother: () => void;
}

const categoryMeta = {
  clarity: { label: "Clarity", description: "Is it clear what you do?" },
  value: { label: "Value Prop", description: "Why you, why now?" },
  structure: { label: "Structure", description: "Easy to scan?" },
  conversion: { label: "Conversion", description: "Does it push action?" },
  trust: { label: "Trust", description: "Any proof or credibility?" },
};

export function RoastResults({ result, onRoastAnother }: Props) {
  const { url, score, llm } = result;
  const { isSignedIn, user } = useUser();
  const [isPro, setIsPro] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/subscription?userId=${user.id}`)
      .then(r => r.json())
      .then(d => setIsPro(d.active));
  }, [user?.id]);

  async function handleUpgrade() {
    if (!isSignedIn) return;
    setUpgrading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, userEmail: user.primaryEmailAddress?.emailAddress }),
      });
      const { url: checkoutUrl } = await res.json();
      if (checkoutUrl) window.location.href = checkoutUrl;
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="text-center space-y-1 pt-2">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Roast complete</p>
        <p className="text-sm text-gray-500">{hostname}</p>
      </div>

      {/* Score */}
      <div className="bg-white border border-gray-100 rounded-2xl p-8 flex flex-col items-center gap-2">
        <ScoreRing score={score.total_score} />
        {score.flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mt-3">
            {score.flags.map((flag, i) => (
              <span
                key={i}
                className="px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-100 rounded-full"
              >
                {flag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Score Breakdown */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Score Breakdown
        </h2>
        <div className="space-y-4">
          {(Object.keys(categoryMeta) as (keyof typeof categoryMeta)[]).map((key) => (
            <ScoreBar
              key={key}
              label={categoryMeta[key].label}
              description={categoryMeta[key].description}
              score={score.breakdown[key]}
            />
          ))}
        </div>
      </div>

      {/* Key Issues */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Key Issues
        </h2>
        <ul className="space-y-3">
          {llm.weaknesses.map((w, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700 leading-relaxed">{w}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Improvements */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          How to Fix It
        </h2>
        <ul className="space-y-3">
          {llm.improvements.map((imp, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xs font-bold">
                ✓
              </span>
              <span className="text-sm text-gray-700 leading-relaxed">{imp}</span>
            </li>
          ))}
        </ul>
      </div>


      {/* Share */}
      <ShareBar result={result} />

      {/* Competitor comparison paywall */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-gray-900">Compare to competitors</h2>
            <p className="text-xs text-gray-400">
              See how your page stacks up against your top 3 competitors — full breakdown + action items.
            </p>
          </div>
          {!isPro && (
            <span className="flex-shrink-0 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
              Pro · €5/mo
            </span>
          )}
        </div>

        {isPro ? (
          <p className="text-xs text-green-600 font-medium">✓ You have Pro access — competitor comparison coming next.</p>
        ) : !isSignedIn ? (
          <SignInButton mode="modal">
            <button
              className="w-full text-sm font-medium py-2.5 rounded-xl text-white transition-colors"
              style={{ backgroundColor: "#92400e" }}
              onClick={() => sessionStorage.setItem("pendingCheckout", "1")}
            >
              Sign in to unlock
            </button>
          </SignInButton>
        ) : (
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="w-full text-sm font-medium py-2.5 rounded-xl text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#92400e" }}
          >
            {upgrading ? "Redirecting to checkout..." : "Unlock for €5/month"}
          </button>
        )}
      </div>

      {/* Roast another */}
      <div className="flex justify-center">
        <button
          onClick={onRoastAnother}
          className="text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors" style={{ backgroundColor: "#92400e" }}
        >
          Roast another page
        </button>
      </div>
    </div>
  );
}
