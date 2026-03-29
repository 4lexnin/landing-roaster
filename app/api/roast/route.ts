import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import { computeScore } from "@/lib/scoring";
import { ScrapedData, RoastResult } from "@/lib/types";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCached, setCache } from "@/lib/cache";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function scrape(url: string): Promise<ScrapedData> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove noise
  $("script, style, noscript, nav, footer, header").remove();

  const title = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") ?? "";
  const h1 = $("h1").first().text().trim();
  const h2s = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 5);

  const ctaElements = $('a[href], button')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 0 && t.length < 60)
    .slice(0, 8);

  const paragraphs = $("p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 40)
    .slice(0, 3);

  const bodyText = $("body").text();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  const hasSocialProof =
    /testimonial|review|rating|star|customer|client|trusted by|loved by|users|companies/i.test(
      bodyText
    );
  const hasPricing = /pricing|price|\$\d|€\d|per month|per year|free plan|paid plan/i.test(bodyText);

  const headline = h1 || title;
  const subheadline = metaDesc || h2s[0] || "";
  const sections = [...h2s, ...paragraphs].slice(0, 6);

  return {
    headline,
    subheadline,
    ctas: ctaElements,
    sections,
    has_social_proof: hasSocialProof,
    has_pricing: hasPricing,
    word_count: wordCount,
  };
}

async function callLLM(
  scraped: ScrapedData,
  flags: string[]
): Promise<{ weaknesses: string[]; improvements: string[]; rewritten_headline: string }> {
  const prompt = `You are a brutal but constructive landing page critic.

Analyze this landing page data and return JSON only.

Headline: "${scraped.headline}"
Subheadline: "${scraped.subheadline}"
CTAs: ${JSON.stringify(scraped.ctas.slice(0, 4))}
Top issues detected: ${JSON.stringify(flags.slice(0, 3))}

Return exactly this JSON structure (no markdown, no explanation):
{
  "weaknesses": ["<sharp 1-line weakness>", "<sharp 1-line weakness>", "<sharp 1-line weakness>"],
  "improvements": ["<concrete 1-line fix>", "<concrete 1-line fix>", "<concrete 1-line fix>"],
  "rewritten_headline": "<better headline, max 12 words, specific and benefit-driven>"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract JSON from the response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Failed to parse LLM response");
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. You can roast up to 5 pages per hour." },
        { status: 429 }
      );
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Normalize URL
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    // Cache check
    const cached = getCached(normalizedUrl);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const scraped = await scrape(normalizedUrl);
    const score = computeScore(scraped);
    const llm = await callLLM(scraped, score.flags);

    const result: RoastResult = {
      url: normalizedUrl,
      scraped,
      score,
      llm,
    };

    setCache(normalizedUrl, result);

    // Increment roast counter (fire and forget)
    import("@upstash/redis").then(({ Redis }) => Redis.fromEnv().incr("roast_count")).catch(() => {});

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
