import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ changes: [] });

  const { data } = await supabaseAdmin
    .from("competitor_changes")
    .select("*, competitors(hostname, url)")
    .eq("user_id", userId)
    .order("detected_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ changes: data ?? [] });
}
