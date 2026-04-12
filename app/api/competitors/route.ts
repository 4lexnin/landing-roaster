import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ competitors: [] });

  const { data } = await supabaseAdmin
    .from("competitors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ competitors: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId, url } = await req.json();
  if (!userId || !url) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const normalized = url.startsWith("http") ? url : `https://${url}`;
  let hostname: string;
  try {
    hostname = new URL(normalized).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("competitors")
    .insert({ user_id: userId, url: normalized, hostname })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ competitor: data });
}
