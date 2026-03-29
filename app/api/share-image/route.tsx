import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

function Bar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 7 ? "#16a34a" : score >= 5 ? "#d97706" : "#dc2626";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
      }}
    >
      <span style={{ fontSize: 14, color: "#6b7280", width: 90 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 8,
          background: "#f3f4f6",
          borderRadius: 999,
          display: "flex",
        }}
      >
        <div
          style={{
            width: `${score * 10}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", width: 36, textAlign: "right" }}>
        {score}/10
      </span>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const hostname = searchParams.get("hostname") ?? "your page";
  const score = parseFloat(searchParams.get("score") ?? "0");
  const clarity = parseInt(searchParams.get("clarity") ?? "0");
  const value = parseInt(searchParams.get("value") ?? "0");
  const structure = parseInt(searchParams.get("structure") ?? "0");
  const conversion = parseInt(searchParams.get("conversion") ?? "0");
  const trust = parseInt(searchParams.get("trust") ?? "0");

  const scoreColor =
    score >= 7 ? "#16a34a" : score >= 5 ? "#d97706" : "#dc2626";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          padding: "64px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
          <span style={{ fontSize: 28 }}>🍞</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
            Landing Page Roaster
          </span>
          <div
            style={{
              marginLeft: "auto",
              background: "#ef4444",
              color: "white",
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: 999,
              letterSpacing: 1,
            }}
          >
            FREE ROAST
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", gap: 80, flex: 1 }}>
          {/* Left: Score */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 220,
            }}
          >
            <div
              style={{
                fontSize: 96,
                fontWeight: 800,
                color: scoreColor,
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <div style={{ fontSize: 24, color: "#9ca3af", marginTop: 4 }}>/10</div>
            <div
              style={{
                marginTop: 20,
                fontSize: 15,
                color: "#374151",
                textAlign: "center",
                maxWidth: 200,
                lineHeight: 1.5,
              }}
            >
              {hostname}
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 22,
                fontWeight: 700,
                color: "#111827",
                textAlign: "center",
              }}
            >
              This page is toasted 🍞
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: "#f3f4f6", alignSelf: "stretch" }} />

          {/* Right: Breakdown */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 18,
              flex: 1,
            }}
          >
            <Bar label="Clarity" score={clarity} />
            <Bar label="Value Prop" score={value} />
            <Bar label="Structure" score={structure} />
            <Bar label="Conversion" score={conversion} />
            <Bar label="Trust" score={trust} />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 40,
            paddingTop: 24,
            borderTop: "1px solid #f3f4f6",
          }}
        >
          <span style={{ fontSize: 13, color: "#9ca3af" }}>
            Get your free roast at landing-roaster.vercel.app
          </span>
          <span style={{ fontSize: 13, color: "#d1d5db" }}>
            Powered by GPT-4o mini
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
