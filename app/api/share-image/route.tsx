import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

function Bar({ label, score }: { label: string; score: number }) {
  const color = score >= 7 ? "#16a34a" : score >= 5 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div style={{ display: "flex", fontSize: 14, color: "#6b7280", width: 90 }}>{label}</div>
      <div style={{ display: "flex", flex: 1, height: 8, background: "#f3f4f6", borderRadius: 999 }}>
        <div style={{ display: "flex", width: `${score * 10}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
      <div style={{ display: "flex", fontSize: 14, fontWeight: 600, color: "#111827", width: 36, justifyContent: "flex-end" }}>
        {score}/10
      </div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isDefault = searchParams.get("default") === "1";

  if (isDefault) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 1200, height: 630, background: "#ffffff", fontFamily: "sans-serif", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 64 }}>🍞</div>
            <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: "#111827" }}>Landing Page Roaster</div>
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#6b7280", textAlign: "center", maxWidth: 600 }}>
            Get a brutally honest, AI-powered critique of your landing page in 30 seconds.
          </div>
          <div style={{ display: "flex", background: "#ef4444", color: "white", fontSize: 16, fontWeight: 700, padding: "10px 24px", borderRadius: 999, marginTop: 8 }}>
            FREE · NO SIGNUP
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } }
    );
  }

  const hostname = searchParams.get("hostname") ?? "your page";
  const score = parseFloat(searchParams.get("score") ?? "0");
  const clarity = parseInt(searchParams.get("clarity") ?? "0");
  const value = parseInt(searchParams.get("value") ?? "0");
  const structure = parseInt(searchParams.get("structure") ?? "0");
  const conversion = parseInt(searchParams.get("conversion") ?? "0");
  const trust = parseInt(searchParams.get("trust") ?? "0");

  const scoreColor = score >= 7 ? "#16a34a" : score >= 5 ? "#d97706" : "#dc2626";

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: 1200, height: 630, background: "#ffffff", padding: "56px 72px", fontFamily: "sans-serif" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
          <div style={{ display: "flex", fontSize: 26 }}>🍞</div>
          <div style={{ display: "flex", fontSize: 17, fontWeight: 700, color: "#111827" }}>Landing Page Roaster</div>
          <div style={{ display: "flex", marginLeft: "auto", background: "#1c1917", color: "white", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 999, letterSpacing: 1 }}>
            FREE ROAST
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, gap: 72 }}>

          {/* Left: score + label */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 220 }}>
            <div style={{ display: "flex", fontSize: 100, fontWeight: 800, color: scoreColor, lineHeight: "1" }}>{score}</div>
            <div style={{ display: "flex", fontSize: 22, color: "#9ca3af", marginTop: 2 }}>/10</div>
            <div style={{ display: "flex", fontSize: 14, color: "#6b7280", marginTop: 16, textAlign: "center" }}>{hostname}</div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#111827", marginTop: 10, textAlign: "center" }}>This page is toasted 🍞</div>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", width: 1, background: "#f3f4f6", alignSelf: "stretch" }} />

          {/* Right: breakdown */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, flex: 1 }}>
            <Bar label="Clarity" score={clarity} />
            <Bar label="Value Prop" score={value} />
            <Bar label="Structure" score={structure} />
            <Bar label="Conversion" score={conversion} />
            <Bar label="Trust" score={trust} />
          </div>

        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 40, paddingTop: 20, borderTop: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", fontSize: 13, color: "#9ca3af" }}>Get your free roast at landing-roaster.vercel.app</div>
          <div style={{ display: "flex", fontSize: 13, color: "#d1d5db" }}>Powered by GPT-4o mini</div>
        </div>

      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
