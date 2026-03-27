"use client";

import { RoastResult } from "@/lib/types";
import { ScoreRing } from "./ScoreRing";
import { ScoreBar } from "./ScoreBar";

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
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

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

      {/* Rewritten Headline */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Rewritten Headline
        </h2>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <p className="text-base font-semibold text-gray-900 leading-snug">
            &ldquo;{llm.rewritten_headline}&rdquo;
          </p>
        </div>
        <p className="text-xs text-gray-400">
          Original: &ldquo;{result.scraped.headline}&rdquo;
        </p>
      </div>

      {/* Teaser */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-3 opacity-70">
        <div className="flex items-center gap-2">
          <span className="text-base">🔒</span>
          <h2 className="text-sm font-semibold text-gray-700">
            Compare your page to competitors
          </h2>
          <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
            Coming soon
          </span>
        </div>
        <p className="text-xs text-gray-400">
          See how your landing page stacks up against your top 3 competitors — side by side.
        </p>
        <input
          disabled
          placeholder="Add a competitor URL..."
          className="w-full text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50 text-gray-400 cursor-not-allowed"
        />
      </div>

      {/* Roast another */}
      <div className="flex justify-center">
        <button
          onClick={onRoastAnother}
          className="bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-xl hover:bg-gray-700 transition-colors"
        >
          Roast another page
        </button>
      </div>
    </div>
  );
}
