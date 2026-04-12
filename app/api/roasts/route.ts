import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(req: NextRequest) {
  const { id, userId } = await req.json();
  if (!id || !userId) return NextResponse.json({ error: "Missing params" }, { status: 400 });
  await supabaseAdmin.from("roasts").delete().eq("id", id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ roasts: [] });

  const { data } = await supabaseAdmin
    .from("roasts")
    .select("id, url, hostname, score, result, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ roasts: data ?? [] });
}
