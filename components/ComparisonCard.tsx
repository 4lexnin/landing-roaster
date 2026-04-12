"use client";

import { ComparisonResult, HeuristicResult } from "@/lib/types";

interface Props {
  yourScore: HeuristicResult;
  comparison: ComparisonResult;
}

const categories: { key: keyof HeuristicResult["breakdown"]; label: string }[] = [
  { key: "clarity", label: "Clarity" },
  { key: "value", label: "Value Prop" },
  { key: "structure", label: "Structure" },
  { key: "conversion", label: "Conversion" },
  { key: "trust", label: "Trust" },
];

function cellStyle(score: number, best: number) {
  if (score === best) return "text-green-600 font-bold";
  if (score >= best - 1.5) return "text-gray-600";
  return "text-red-500";
}

const verdictConfig = {
  winning: { bg: "bg-green-50", border: "border-green-100", badge: "bg-green-100 text-green-700", icon: "↑", label: "Winning" },
  losing:  { bg: "bg-red-50",   border: "border-red-100",   badge: "bg-red-100 text-red-700",     icon: "↓", label: "Behind"  },
  tied:    { bg: "bg-gray-50",  border: "border-gray-100",  badge: "bg-gray-100 text-gray-600",   icon: "→", label: "Tied"    },
};

export function ComparisonCard({ yourScore, comparison }: Props) {
  const { competitors, insights } = comparison;

  return (
    <div className="space-y-6">
      {/* Comparison table */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 pr-3 text-xs font-semibold uppercase tracking-widest text-gray-400 w-24">
                Category
              </th>
              <th className="text-center py-2 px-2 text-xs font-semibold text-amber-700 bg-amber-50 rounded-t-md min-w-14">
                You
              </th>
              {competitors.map((c) => (
                <th key={c.hostname} className="text-center py-2 px-2 text-xs font-medium text-gray-400 min-w-20">
                  <span className="block truncate max-w-20">{c.hostname.replace("www.", "")}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(({ key, label }) => {
              const yourVal = yourScore.breakdown[key];
              const allVals = [yourVal, ...competitors.map((c) => c.score.breakdown[key])];
              const best = Math.max(...allVals);
              return (
                <tr key={key} className="border-b border-gray-50">
                  <td className="py-2.5 pr-3 text-xs text-gray-500">{label}</td>
                  <td className={`text-center py-2.5 px-2 tabular-nums text-sm ${cellStyle(yourVal, best)}`}>
                    {yourVal}
                  </td>
                  {competitors.map((c) => {
                    const val = c.score.breakdown[key];
                    return (
                      <td key={c.hostname} className={`text-center py-2.5 px-2 tabular-nums text-sm ${cellStyle(val, best)}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-200">
              <td className="py-3 pr-3 text-xs font-semibold text-gray-700">Overall</td>
              {(() => {
                const allTotals = [yourScore.total_score, ...competitors.map((c) => c.score.total_score)];
                const best = Math.max(...allTotals);
                return (
                  <>
                    <td className={`text-center py-3 px-2 tabular-nums text-sm font-bold ${cellStyle(yourScore.total_score, best)}`}>
                      {yourScore.total_score}
                    </td>
                    {competitors.map((c) => (
                      <td key={c.hostname} className={`text-center py-3 px-2 tabular-nums text-sm font-bold ${cellStyle(c.score.total_score, best)}`}>
                        {c.score.total_score}
                      </td>
                    ))}
                  </>
                );
              })()}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Competitive insights</p>
          <div className="space-y-2">
            {insights.map((insight, i) => {
              const cfg = verdictConfig[insight.verdict] ?? verdictConfig.tied;
              return (
                <div key={i} className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{insight.label}</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{insight.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
