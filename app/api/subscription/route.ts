import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ active: false });

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();

  console.log("subscription check", { userId, data, error, hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY });

  return NextResponse.json({ active: data?.status === "active" });
}
