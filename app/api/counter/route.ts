import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = Redis.fromEnv();
    const count = (await redis.get<number>("roast_count")) ?? 0;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
