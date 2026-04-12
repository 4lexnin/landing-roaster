import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Public client — for client-side or read-only server use
export const supabase = createClient(url, anonKey);

// Server-side client with full write access (bypasses RLS)
export const supabaseAdmin = createClient(url, serviceKey);
