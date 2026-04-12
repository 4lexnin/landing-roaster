import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { detectChanges, CompetitorSnapshot, Change } from "@/lib/changeDetector";
import { computeScore } from "@/lib/scoring";
import { HeuristicResult } from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

function parseSnapshot(html: string): Omit<CompetitorSnapshot, "client_list"> {
  const $ = cheerio.load(html);

  const headline = $("h1").first().text().trim() || $("title").first().text().trim();
  const subheadline = $("h2").first().text().trim() || $("meta[name='description']").attr("content")?.trim() || "";

  // Only pick up actual CTAs: buttons + non-nav links that are short and action-like
  // Exclude nav/header/footer links to avoid concatenated nav text
  const ctaSet = new Set<string>();
  $("button").each((_, el) => {
    const t = $(el).clone().children().remove().end().text().trim();
    if (t.length > 1 && t.length < 40) ctaSet.add(t);
  });
  $("a[href]").not("nav a, header a, footer a").each((_, el) => {
    // Only direct text, not nested text (avoids nav+subtitle concatenations)
    const t = $(el).clone().children("span, div, p").remove().end().text().trim();
    if (t.length > 2 && t.length < 35 && !/^http/.test(t)) ctaSet.add(t);
  });
  const ctas = [...ctaSet].slice(0, 10);

  const sections = $("h2, h3").map((_, el) => $(el).text().trim()).get()
    .filter(t => t.length > 3 && t.length < 100).slice(0, 10);

  const bodyText = $("body").text();
  const word_count = bodyText.split(/\s+/).filter(Boolean).length;
  const has_social_proof = /testimonial|review|rating|star|customer|client|trusted by|loved by|users|companies/i.test(bodyText);
  const has_pricing = /pricing|price|\$\d|€\d|per month|per year|free plan|paid plan/i.test(bodyText);

  const navLinks = new Set<string>();
  $("nav a, header a").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("/") && href.length > 1 && !href.includes("#")) navLinks.add(href.split("?")[0]);
  });

  return { headline, subheadline, ctas, sections, has_social_proof, has_pricing, nav_links: [...navLinks].slice(0, 20), word_count };
}

function extractClientContext(html: string): string {
  const $ = cheerio.load(html);
  const CLIENT_KEYWORDS = /trusted by|used by|our customers|our clients|join .{0,20}companies|loved by|powers|customers include|works with/i;
  const chunks: string[] = [];

  $("*").each((_, el) => {
    const text = $(el).text();
    if (CLIENT_KEYWORDS.test(text) && text.length < 2000) {
      const alts = $(el).find("img[alt]").map((_, img) => $(img).attr("alt")).get()
        .filter((a): a is string => !!a && a.length > 1 && a.length < 60);
      chunks.push(text.slice(0, 800));
      if (alts.length) chunks.push("Logo alts: " + alts.join(", "));
    }
  });

  const allAlts = $("img[alt]").map((_, img) => $(img).attr("alt")).get()
    .filter((a): a is string => !!a && a.length > 1 && a.length < 60 && !/logo|icon|arrow|menu|close|search/i.test(a))
    .slice(0, 40);
  if (allAlts.length) chunks.push("All image alts: " + allAlts.join(", "));

  return [...new Set(chunks)].join("\n\n").slice(0, 2000);
}

async function extractClients(html: string): Promise<string[]> {
  const context = extractClientContext(html);
  if (!context) return [];
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `From this landing page content, extract company names that are CUSTOMERS or CLIENTS of this product — companies that USE or BUY the product.

EXCLUDE: investors, VCs, venture funds, accelerators, advisors, partners, sponsors, press mentions.
INCLUDE ONLY: companies shown in "trusted by", "used by", "our customers", "clients" sections — companies that are actual end-users of the product.

Return a JSON array of strings, max 20. If none found, return [].

Content:
${context}`,
      }],
      max_tokens: 200,
      temperature: 0,
    });
    const raw = res.choices[0].message.content?.trim() ?? "[]";
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.filter((s: unknown) => typeof s === "string").slice(0, 20) : [];
  } catch {
    return [];
  }
}

async function scrapeWithClients(url: string, filterTerms: string[] = []): Promise<CompetitorSnapshot> {
  const html = await fetchHtml(url);
  const [base, rawClients] = await Promise.all([
    Promise.resolve(parseSnapshot(html)),
    extractClients(html),
  ]);
  // Remove the competitor's own brand/hostname from the client list
  const client_list = rawClients.filter(c =>
    !filterTerms.some(t => c.toLowerCase().includes(t.toLowerCase()))
  );
  return { ...base, client_list };
}

export interface CompetitiveProfile {
  target_audience: string;
  positioning: string;
  strategy: string;
  opportunities: string;
}

async function generateCompetitiveProfile(hostname: string, snapshot: CompetitorSnapshot): Promise<CompetitiveProfile> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `You are a B2B marketing strategist. Analyse ${hostname}'s landing page and return sharp, one-sentence insights. No filler, no "they are", no "this company".

Data:
- Headline: "${snapshot.headline}"
- Subheadline: "${snapshot.subheadline}"
- CTAs: ${JSON.stringify(snapshot.ctas.slice(0, 5))}
- Sections: ${JSON.stringify(snapshot.sections.slice(0, 8))}
- Social proof: ${snapshot.has_social_proof}, Pricing: ${snapshot.has_pricing}
- Clients: ${JSON.stringify(snapshot.client_list?.slice(0, 8) ?? [])}

Return ONLY this JSON (no markdown):
{
  "target_audience": "Max 15 words. Who exactly. e.g. 'Enterprise compliance teams at crypto-native financial institutions.'",
  "positioning": "Max 15 words. Their unique angle. e.g. 'The only audit-ready blockchain analytics built for regulated industries.'",
  "strategy": "Max 20 words. One key strategic signal from the page. e.g. 'Going upmarket via enterprise logos and compliance framing — abandoning self-serve.'",
  "opportunities": "Max 25 words. The gap a competitor could own. e.g. 'No mention of ROI or time-to-value — an easy wedge for a challenger with a faster onboarding story.'"
}`,
    }],
    max_tokens: 400,
    temperature: 0.7,
  });

  try {
    const raw = res.choices[0].message.content?.trim() ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON");
    return JSON.parse(match[0]);
  } catch {
    return { target_audience: "", positioning: "", strategy: "", opportunities: "" };
  }
}


function formatChangesForAI(changes: Change[]): string {
  return changes.map(c => {
    if (c.type === "headline") return `Headline: "${c.from}" → "${c.to}"`;
    if (c.type === "cta_added") return `New CTA: "${c.value}"`;
    if (c.type === "cta_removed") return `CTA removed: "${c.value}"`;
    if (c.type === "social_proof") return c.added ? "Social proof appeared" : "Social proof removed";
    if (c.type === "pricing") return c.added ? "Pricing appeared" : "Pricing removed";
    if (c.type === "nav_added") return `New nav page: ${c.value}`;
    if (c.type === "nav_removed") return `Nav page removed: ${c.value}`;
    if (c.type === "client_added") return `New client: "${c.value}"`;
    if (c.type === "client_removed") return `Client removed: "${c.value}"`;
    return "";
  }).filter(Boolean).join("\n");
}

async function generateInsight(hostname: string, changes: Change[]): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Competitive analyst: ${hostname} just made these landing page changes:\n\n${formatChangesForAI(changes)}\n\nIn 1-2 sentences: what does this signal about their strategy, and what should their competitors do about it? Be direct and actionable.`,
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
  score: HeuristicResult;
  profile: CompetitiveProfile;
  changes: Change[];
  aiInsight?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data: competitors } = await supabaseAdmin.from("competitors").select("*").eq("user_id", userId);
  if (!competitors?.length) return NextResponse.json({ results: [] });

  const results: MonitorResult[] = [];

  await Promise.allSettled(
    competitors.map(async (competitor) => {
      try {
        // Pass hostname parts as filter terms to exclude from client list
        const hostParts = competitor.hostname.replace("www.", "").split(".").filter((p: string) => p.length > 2);
        const current = await scrapeWithClients(competitor.url, hostParts);

        const [scoreResult, profileResult, lastSnapshotResult] = await Promise.allSettled([
          Promise.resolve(computeScore({
            headline: current.headline,
            subheadline: current.subheadline,
            ctas: current.ctas,
            sections: current.sections,
            has_social_proof: current.has_social_proof,
            has_pricing: current.has_pricing,
            word_count: current.word_count,
          })),
          generateCompetitiveProfile(competitor.hostname, current),
          supabaseAdmin.from("competitor_snapshots").select("*").eq("competitor_id", competitor.id).order("created_at", { ascending: false }).limit(1).single(),
        ]);

        const score = scoreResult.status === "fulfilled" ? scoreResult.value : { total_score: 0, breakdown: { clarity: 0, value: 0, structure: 0, conversion: 0, trust: 0 }, flags: [], breakdown_flags: { clarity: [], value: [], structure: [], conversion: [], trust: [] } };
        const profile = profileResult.status === "fulfilled" ? profileResult.value : { target_audience: "", positioning: "", strategy: "", opportunities: "" };
        const lastSnapshot = lastSnapshotResult.status === "fulfilled" ? lastSnapshotResult.value.data : null;

        await supabaseAdmin.from("competitor_snapshots").insert({
          competitor_id: competitor.id,
          user_id: userId,
          headline: current.headline,
          ctas: current.ctas,
          has_social_proof: current.has_social_proof,
          has_pricing: current.has_pricing,
          nav_links: current.nav_links,
          client_list: current.client_list,
        });

        // Incremental diff since last scan
        const isFirstRun = !lastSnapshot;
        let changes: Change[] = [];
        let aiInsight: string | undefined;

        if (lastSnapshot) {
          const prev: CompetitorSnapshot = {
            headline: lastSnapshot.headline ?? "",
            subheadline: "",
            ctas: lastSnapshot.ctas ?? [],
            sections: [],
            has_social_proof: lastSnapshot.has_social_proof ?? false,
            has_pricing: lastSnapshot.has_pricing ?? false,
            nav_links: lastSnapshot.nav_links ?? [],
            word_count: 0,
            client_list: lastSnapshot.client_list ?? [],
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

        results.push({ competitorId: competitor.id, hostname: competitor.hostname, url: competitor.url, isFirstRun, snapshot: current, score, profile, changes, aiInsight });
      } catch (err) {
        results.push({
          competitorId: competitor.id, hostname: competitor.hostname, url: competitor.url, isFirstRun: false,
          snapshot: { headline: "", subheadline: "", ctas: [], sections: [], has_social_proof: false, has_pricing: false, nav_links: [], word_count: 0, client_list: [] },
          score: { total_score: 0, breakdown: { clarity: 0, value: 0, structure: 0, conversion: 0, trust: 0 }, flags: [], breakdown_flags: { clarity: [], value: [], structure: [], conversion: [], trust: [] } },
          profile: { target_audience: "", positioning: "", strategy: "", opportunities: "" },
          changes: [],
          error: err instanceof Error ? err.message : "Failed to scrape",
        });
      }
    })
  );

  return NextResponse.json({ results, checkedAt: new Date().toISOString() });
}
