export interface ScrapedData {
  headline: string;
  subheadline: string;
  ctas: string[];
  sections: string[];
  has_social_proof: boolean;
  has_pricing: boolean;
  word_count: number;
}

export interface ScoreBreakdown {
  clarity: number;
  value: number;
  structure: number;
  conversion: number;
  trust: number;
}

export interface HeuristicResult {
  total_score: number;
  breakdown: ScoreBreakdown;
  flags: string[];
  breakdown_flags: Record<keyof ScoreBreakdown, string[]>;
}

export interface LLMResult {
  weaknesses: string[];
  improvements: string[];
  rewritten_headline: string;
}

export interface RoastResult {
  url: string;
  scraped: ScrapedData;
  score: HeuristicResult;
  llm: LLMResult;
}

export interface CompetitorEntry {
  url: string;
  hostname: string;
  score: HeuristicResult;
}

export interface CompetitorInsight {
  label: string;
  verdict: "winning" | "losing" | "tied";
  detail: string;
}

export interface ComparisonResult {
  competitors: CompetitorEntry[];
  insights: CompetitorInsight[];
}
