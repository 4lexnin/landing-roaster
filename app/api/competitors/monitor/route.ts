import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { detectChanges, CompetitorSnapshot, Change } from "@/lib/changeDetector";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  return { headline, ctas, has_social_proof, has_pricing, nav_links: [...navLinks].slice(0, 20) };
}

async function getWaybackSnapshot(url: string): Promise<{ snapshot: CompetitorSnapshot; date: string } | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const timestamp = thirtyDaysAgo.toISOString().replace(/\D/g, "").slice(0, 14);

  const availRes = await fetch(
    `https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${timestamp}`,
    { signal: AbortSignal.timeout(6000) }
  );
  const availData = await availRes.json();
  const closest = availData?.archived_snapshots?.closest;
  if (!closest?.available || !closest?.url) return null;

  const snapshot = await scrape(closest.url);
  return { snapshot, date: closest.timestamp };
}

function formatChangesForAI(changes: Change[]): string {
  return changes.map(c => {
    if (c.type === "headline") return `Headline changed from "${c.from}" to "${c.to}"`;
    if (c.type === "cta_added") return `New CTA added: "${c.value}"`;
    if (c.type === "cta_removed") return `CTA removed: "${c.value}"`;
    if (c.type === "social_proof") return c.added ? "Social proof section appeared" : "Social proof section removed";
    if (c.type === "pricing") return c.added ? "Pricing section appeared" : "Pricing section removed";
    if (c.type === "nav_added") return `New page added to nav: ${c.value}`;
    if (c.type === "nav_removed") return `Page removed from nav: ${c.value}`;
    return "";
  }).filter(Boolean).join("\n");
}

async function generateInsight(hostname: string, changes: Change[]): Promise<string> {
  const changeList = formatChangesForAI(changes);
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `You are a competitive intelligence analyst. ${hostname} made these changes to their landing page:\n\n${changeList}\n\nIn 1-2 sentences, what does this tell us about their strategy or direction? Be direct and specific.`,
    }],
    max_tokens: 120,
    temperature: 0.7,
  });
  return res.choices[0].message.content?.trim() ?? "";
}

export interface MonitorResult {
  competitorId: string;
  hostname: string;
  url: string;
  isFirstRun: boolean;
  snapshot: CompetitorSnapshot;
  // 30-day Wayback comparison — always attempted
  waybackDate?: string;
  waybackChanges?: Change[];
  waybackInsight?: string;
  // Incremental changes since last scan (saved to DB history)
  changes: Change[];
  aiInsight?: string;
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

        // Get last snapshot for incremental diff
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

        // Always try 30-day Wayback comparison
        let waybackDate: string | undefined;
        let waybackChanges: Change[] | undefined;
        let waybackInsight: string | undefined;

        try {
          const wayback = await getWaybackSnapshot(competitor.url);
          if (wayback) {
            waybackDate = wayback.date;
            waybackChanges = detectChanges(wayback.snapshot, current);
            if (waybackChanges.length > 0) {
              waybackInsight = await generateInsight(competitor.hostname, waybackChanges);
            }
          }
        } catch {
          // Wayback unavailable — silent fallback
        }

        // Incremental diff since last scan
        const isFirstRun = !lastSnapshot;
        let changes: Change[] = [];
        let aiInsight: string | undefined;

        if (lastSnapshot) {
          const prev: CompetitorSnapshot = {
            headline: lastSnapshot.headline ?? "",
            ctas: lastSnapshot.ctas ?? [],
            has_social_proof: lastSnapshot.has_social_proof ?? false,
            has_pricing: lastSnapshot.has_pricing ?? false,
            nav_links: lastSnapshot.nav_links ?? [],
          };
          changes = detectChanges(prev, current);
          if (changes.length > 0) {
            aiInsight = await generateInsight(competitor.hostname, changes);
            await supabaseAdmin.from("competitor_changes").insert(
              changes.map((c) => ({
                competitor_id: competitor.id,
                user_id: userId,
                change_type: c.type,
                from_value: c.from ?? null,
                to_value: c.to ?? null,
                value: c.value ?? null,
                added: c.added ?? null,
              }))
            );
          }
        }

        results.push({
          competitorId: competitor.id,
          hostname: competitor.hostname,
          url: competitor.url,
          isFirstRun,
          snapshot: current,
          waybackDate,
          waybackChanges,
          waybackInsight,
          changes,
          aiInsight,
        });
      } catch (err) {
        results.push({
          competitorId: competitor.id,
          hostname: competitor.hostname,
          url: competitor.url,
          isFirstRun: false,
          snapshot: { headline: "", ctas: [], has_social_proof: false, has_pricing: false, nav_links: [] },
          changes: [],
          error: err instanceof Error ? err.message : "Failed to scrape",
        });
      }
    })
  );

  return NextResponse.json({ results, checkedAt: new Date().toISOString() });
}
