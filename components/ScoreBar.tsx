"use client";

interface Props {
  label: string;
  score: number;
  description: string;
}

function getColor(score: number): string {
  if (score >= 7) return "bg-green-500";
  if (score >= 5) return "bg-amber-400";
  return "bg-red-400";
}

export function ScoreBar({ label, score, description }: Props) {
  const color = getColor(score);
  const width = `${score * 10}%`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="ml-2 text-xs text-gray-400">{description}</span>
        </div>
        <span className="text-sm font-semibold text-gray-800">{score}/10</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width }}
        />
      </div>
    </div>
  );
}
