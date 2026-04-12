export interface CompetitorSnapshot {
  headline: string;
  ctas: string[];
  has_social_proof: boolean;
  has_pricing: boolean;
  nav_links: string[];
}

export interface Change {
  type: "headline" | "cta_added" | "cta_removed" | "social_proof" | "pricing" | "nav_added" | "nav_removed";
  from?: string;
  to?: string;
  value?: string;
  added?: boolean;
}

export function detectChanges(prev: CompetitorSnapshot, curr: CompetitorSnapshot): Change[] {
  const changes: Change[] = [];

  if (prev.headline !== curr.headline && curr.headline) {
    changes.push({ type: "headline", from: prev.headline, to: curr.headline });
  }

  const prevCtas = new Set(prev.ctas ?? []);
  const currCtas = new Set(curr.ctas ?? []);
  for (const cta of curr.ctas ?? []) {
    if (!prevCtas.has(cta)) changes.push({ type: "cta_added", value: cta });
  }
  for (const cta of prev.ctas ?? []) {
    if (!currCtas.has(cta)) changes.push({ type: "cta_removed", value: cta });
  }

  if (prev.has_social_proof !== curr.has_social_proof) {
    changes.push({ type: "social_proof", added: curr.has_social_proof });
  }

  if (prev.has_pricing !== curr.has_pricing) {
    changes.push({ type: "pricing", added: curr.has_pricing });
  }

  const prevNav = new Set(prev.nav_links ?? []);
  const currNav = new Set(curr.nav_links ?? []);
  for (const link of curr.nav_links ?? []) {
    if (!prevNav.has(link)) changes.push({ type: "nav_added", value: link });
  }
  for (const link of prev.nav_links ?? []) {
    if (!currNav.has(link)) changes.push({ type: "nav_removed", value: link });
  }

  return changes;
}
