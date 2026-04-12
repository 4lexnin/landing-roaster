import { ScrapedData, HeuristicResult, ScoreBreakdown } from "./types";

const BUZZWORDS = [
  "innovative", "revolutionary", "cutting-edge", "world-class", "best-in-class",
  "synergy", "disruptive", "leverage", "seamless", "holistic", "robust", "scalable",
  "next-generation", "state-of-the-art", "empower", "transform", "optimize",
];

const WEAK_CTAS = ["submit", "click here", "learn more", "read more", "go", "ok"];

function clamp(n: number): number {
  return Math.max(0, Math.min(10, n));
}

function scoreClarity(data: ScrapedData): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  const headline = data.headline.toLowerCase();
  const allText = [data.headline, data.subheadline, ...data.sections].join(" ").toLowerCase();

  // Clear what product does
  if (data.headline.length > 10 && data.headline.length < 120) score += 4;
  else flags.push("Unclear or missing headline");

  // Specific audience signal
  if (data.subheadline.length > 20) score += 3;
  else flags.push("Weak or missing subheadline");

  // Buzzword penalty
  const buzzCount = BUZZWORDS.filter((w) => allText.includes(w)).length;
  if (buzzCount === 0) score += 3;
  else if (buzzCount === 1) score += 1;
  else flags.push("Buzzword-heavy copy");

  // Vague headline penalty
  const vagueTerms = ["welcome", "home", "hello", "we are", "we help"];
  if (vagueTerms.some((t) => headline.includes(t))) {
    score -= 3;
    flags.push("Vague headline");
  }

  return { score: clamp(score), flags };
}

function scoreValue(data: ScrapedData): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  const allText = [data.headline, data.subheadline, ...data.sections].join(" ").toLowerCase();

  // Clear benefit
  const benefitSignals = ["save", "increase", "reduce", "grow", "boost", "get", "achieve", "improve", "faster", "easier"];
  const hasBenefit = benefitSignals.some((s) => allText.includes(s));
  if (hasBenefit) score += 5;
  else { score += 1; flags.push("No clear outcome or benefit stated"); }

  // Differentiation
  const diffSignals = ["only", "unlike", "instead of", "without", "no more", "first", "unique"];
  if (diffSignals.some((s) => allText.includes(s))) score += 3;
  else flags.push("No differentiation from competitors");

  // Outcome-focused
  const outcomeSignals = ["result", "outcome", "you'll", "you will", "your team", "your business"];
  if (outcomeSignals.some((s) => allText.includes(s))) score += 2;

  // Feature-only penalty
  const featureHeavy = allText.includes("feature") && !hasBenefit;
  if (featureHeavy) { score -= 3; flags.push("Feature-focused, not benefit-focused"); }

  // Generic claims penalty
  const genericClaims = ["best", "easiest", "simplest", "most powerful"];
  if (genericClaims.filter((g) => allText.includes(g)).length >= 2) {
    score -= 2;
    flags.push("Generic claims without proof");
  }

  return { score: clamp(score), flags };
}

function scoreStructure(data: ScrapedData): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  // Logical sections
  if (data.sections.length >= 3) score += 4;
  else if (data.sections.length >= 1) score += 2;
  else flags.push("Little to no content structure detected");

  // Scannable layout (has subheadline)
  if (data.subheadline.length > 10) score += 3;

  // Good hierarchy (has both headline and sections)
  if (data.headline && data.sections.length > 0) score += 3;

  // Too dense penalty
  if (data.word_count > 800) { score -= 2; flags.push("Page may be too text-heavy"); }

  // Unclear flow
  if (data.sections.length < 2 && data.word_count > 200) {
    score -= 3;
    flags.push("Unclear content flow");
  }

  return { score: clamp(score), flags };
}

function scoreConversion(data: ScrapedData): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if (data.ctas.length === 0) {
    score -= 5;
    flags.push("No CTA found");
    return { score: clamp(score), flags };
  }

  // Clear CTA exists
  score += 4;

  // Multiple CTAs
  if (data.ctas.length >= 2) score += 2;

  // Action-oriented CTA copy
  const actionWords = ["start", "try", "get", "join", "sign up", "book", "schedule", "buy", "access", "download", "claim"];
  const hasActionCTA = data.ctas.some((cta) =>
    actionWords.some((a) => cta.toLowerCase().includes(a))
  );
  if (hasActionCTA) score += 4;
  else {
    const hasWeakCTA = data.ctas.some((cta) =>
      WEAK_CTAS.some((w) => cta.toLowerCase().trim() === w)
    );
    if (hasWeakCTA) { score -= 2; flags.push("Weak or generic CTA copy"); }
    else flags.push("CTA copy could be more action-oriented");
  }

  return { score: clamp(score), flags };
}

function scoreTrust(data: ScrapedData): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  const allText = [data.headline, data.subheadline, ...data.sections].join(" ").toLowerCase();

  // Social proof
  if (data.has_social_proof) score += 5;
  else { flags.push("No social proof detected"); }

  // Numbers / proof
  const hasNumbers = /\d+[k+%mx]|\d+ (users|customers|companies|teams|clients)/i.test(allText);
  if (hasNumbers) score += 3;

  // Credibility signals
  const credSignals = ["trusted", "rated", "award", "certified", "featured in", "as seen", "g2", "capterra", "review"];
  if (credSignals.some((s) => allText.includes(s))) score += 2;

  if (!data.has_social_proof) score -= 5;

  return { score: clamp(score), flags };
}

export function computeScore(data: ScrapedData): HeuristicResult {
  const clarity = scoreClarity(data);
  const value = scoreValue(data);
  const structure = scoreStructure(data);
  const conversion = scoreConversion(data);
  const trust = scoreTrust(data);

  const breakdown: ScoreBreakdown = {
    clarity: clarity.score,
    value: value.score,
    structure: structure.score,
    conversion: conversion.score,
    trust: trust.score,
  };

  const total_score =
    Math.round(
      ((breakdown.clarity + breakdown.value + breakdown.structure + breakdown.conversion + breakdown.trust) / 5) * 10
    ) / 10;

  const allFlags = [
    ...clarity.flags,
    ...value.flags,
    ...structure.flags,
    ...conversion.flags,
    ...trust.flags,
  ].slice(0, 6);

  const breakdown_flags = {
    clarity: clarity.flags,
    value: value.flags,
    structure: structure.flags,
    conversion: conversion.flags,
    trust: trust.flags,
  };

  return { total_score, breakdown, flags: allFlags, breakdown_flags };
}
