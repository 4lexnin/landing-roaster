import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import { computeScore } from "@/lib/scoring";
import { ScrapedData, CompetitorEntry, ComparisonResult } from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function scrape(url: string): Promise<ScrapedData> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header").remove();
  const title = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") ?? "";
  const h1 = $("h1").first().text().trim();
  const h2s = $("h2").map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 5);
  const ctaElements = $("a[href], button").map((_, el) => $(el).text().trim()).get().filter((t) => t.length > 0 && t.length < 60).slice(0, 8);
  const paragraphs = $("p").map((_, el) => $(el).text().trim()).get().filter((t) => t.length > 40).slice(0, 3);
  const bodyText = $("body").text();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const hasSocialProof = /testimonial|review|rating|star|customer|client|trusted by|loved by|users|companies/i.test(bodyText);
  const hasPricing = /pricing|price|\$\d|€\d|per month|per year|free plan|paid plan/i.test(bodyText);
  return {
    headline: h1 || title,
    subheadline: metaDesc || h2s[0] || "",
    ctas: ctaElements,
    sections: [...h2s, ...paragraphs].slice(0, 6),
    has_social_proof: hasSocialProof,
    has_pricing: hasPricing,
    word_count: wordCount,
  };
}

async function findCompetitorUrls(headline: string, subheadline: string): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `You are a market research expert. Based on this product landing page:
Headline: "${headline}"
Subheadline: "${subheadline}"

List 5 real competitor homepages (well-known companies with live websites). Return ONLY a JSON array of 5 URLs, no explanation, no markdown.
Example: ["https://competitor1.com", "https://competitor2.com", "https://competitor3.com", "https://competitor4.com", "https://competitor5.com"]`,
    }],
    max_tokens: 200,
    temperature: 0.3,
  });
  const raw = completion.choices[0]?.message?.content ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]).slice(0, 5);
    return [];
  }
}

async function generateInsights(
  yourHeadline: string,
  yourScore: number,
  competitors: CompetitorEntry[]
): Promise<{ label: string; verdict: "winning" | "losing" | "tied"; detail: string }[]> {
  const competitorSummary = competitors
    .map((c) => `${c.hostname}: ${c.score.total_score}/10 (clarity:${c.score.breakdown.clarity} value:${c.score.breakdown.value} conversion:${c.score.breakdown.conversion} trust:${c.score.breakdown.trust})`)
    .join("\n");
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Landing page comparison:
Your page: "${yourHeadline}" — ${yourScore}/10
Competitors:
${competitorSummary}

Give 3 competitive insights. For each, identify a specific area (e.g. "Value Prop", "Trust signals", "CTA strength"), verdict (winning/losing/tied), and a sharp 1-2 sentence insight.

Return ONLY a JSON array, no markdown:
[
  { "label": "area name", "verdict": "winning|losing|tied", "detail": "sharp insight" },
  ...
]`,
    }],
    max_tokens: 400,
    temperature: 0.7,
  });
  const raw = completion.choices[0]?.message?.content ?? "[]";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]).slice(0, 3);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, scraped, yourScore } = await req.json();

    if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const competitorUrls = await findCompetitorUrls(scraped.headline, scraped.subheadline);

    const competitors: CompetitorEntry[] = [];
    await Promise.allSettled(
      competitorUrls.map(async (url: string) => {
        // try both with and without www
        const urlsToTry = [url, url.replace("://", "://www."), url.replace("://www.", "://")];
        for (const u of urlsToTry) {
          try {
            const competitorScraped = await scrape(u);
            const score = computeScore(competitorScraped);
            competitors.push({ url: u, hostname: new URL(u).hostname, score });
            return;
          } catch {
            // try next variant
          }
        }
      })
    );
    // Keep only first 3 that succeeded
    competitors.splice(3);

    const insights = await generateInsights(scraped.headline, yourScore, competitors);

    const result: ComparisonResult = { competitors, insights };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
