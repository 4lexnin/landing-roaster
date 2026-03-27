"use client";

interface Props {
  score: number;
}

function getColor(score: number): string {
  if (score >= 7) return "#16a34a"; // green
  if (score >= 5) return "#d97706"; // amber
  return "#dc2626"; // red
}

function getLabel(score: number): string {
  if (score >= 8) return "Strong";
  if (score >= 6) return "Average";
  if (score >= 4) return "Weak";
  return "Critical";
}

export function ScoreRing({ score }: Props) {
  const color = getColor(score);
  const label = getLabel(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="10"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900" style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-gray-400">/10</span>
        </div>
      </div>
      <span className="text-sm font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
