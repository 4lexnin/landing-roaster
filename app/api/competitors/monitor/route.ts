import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { supabaseAdmin } from "@/lib/supabase";
import { detectChanges, CompetitorSnapshot, Change } from "@/lib/changeDetector";

async function scrape(url: string): Promise<CompetitorSnapshot> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const headline = $("h1").first().text().trim() || $("title").first().text().trim();

  const ctas = [...new Set(
    $("a[href], button")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(t => t.length > 2 && t.length < 60)
      .slice(0, 12)
  )];

  const bodyText = $("body").text();
  const has_social_proof = /testimonial|review|rating|star|customer|client|trusted by|loved by|users|companies/i.test(bodyText);
  const has_pricing = /pricing|price|\$\d|€\d|per month|per year|free plan|paid plan/i.test(bodyText);

  const navLinks = new Set<string>();
  $("nav a, header a").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("/") && href.length > 1 && !href.includes("#")) {
      navLinks.add(href.split("?")[0]);
    }
  });

  return {
    headline,
    ctas,
    has_social_proof,
    has_pricing,
    nav_links: [...navLinks].slice(0, 20),
  };
}

export interface MonitorResult {
  competitorId: string;
  hostname: string;
  url: string;
  isFirstRun: boolean;
  changes: Change[];
  snapshot: CompetitorSnapshot;
  error?: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data: competitors } = await supabaseAdmin
    .from("competitors")
    .select("*")
    .eq("user_id", userId);

  if (!competitors?.length) return NextResponse.json({ results: [] });

  const results: MonitorResult[] = [];

  await Promise.allSettled(
    competitors.map(async (competitor) => {
      try {
        const current = await scrape(competitor.url);

        // Get last snapshot
        const { data: lastSnapshot } = await supabaseAdmin
          .from("competitor_snapshots")
          .select("*")
          .eq("competitor_id", competitor.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Save new snapshot
        await supabaseAdmin.from("competitor_snapshots").insert({
          competitor_id: competitor.id,
          user_id: userId,
          headline: current.headline,
          ctas: current.ctas,
          has_social_proof: current.has_social_proof,
          has_pricing: current.has_pricing,
          nav_links: current.nav_links,
        });

        if (!lastSnapshot) {
          results.push({ competitorId: competitor.id, hostname: competitor.hostname, url: competitor.url, isFirstRun: true, changes: [], snapshot: current });
          return;
        }

        const prev: CompetitorSnapshot = {
          headline: lastSnapshot.headline ?? "",
          ctas: lastSnapshot.ctas ?? [],
          has_social_proof: lastSnapshot.has_social_proof ?? false,
          has_pricing: lastSnapshot.has_pricing ?? false,
          nav_links: lastSnapshot.nav_links ?? [],
        };

        const changes = detectChanges(prev, current);
        results.push({ competitorId: competitor.id, hostname: competitor.hostname, url: competitor.url, isFirstRun: false, changes, snapshot: current });
      } catch (err) {
        results.push({
          competitorId: competitor.id,
          hostname: competitor.hostname,
          url: competitor.url,
          isFirstRun: false,
          changes: [],
          snapshot: { headline: "", ctas: [], has_social_proof: false, has_pricing: false, nav_links: [] },
          error: err instanceof Error ? err.message : "Failed to scrape",
        });
      }
    })
  );

  return NextResponse.json({ results, checkedAt: new Date().toISOString() });
}
