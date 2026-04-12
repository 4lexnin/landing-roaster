import { NextRequest, NextResponse } from "next/server";
import { supabaseAdminAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ active: false });

  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({ active: data?.status === "active" });
}
