import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = Redis.fromEnv();
    const results = await redis.zrange<string[]>("leaderboard", 0, 9, {
      rev: true,
      withScores: true,
    });

    // results is [member, score, member, score, ...]
    const entries: { hostname: string; score: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({
        hostname: results[i] as string,
        score: parseFloat(results[i + 1] as unknown as string),
      });
    }

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}
