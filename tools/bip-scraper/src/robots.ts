// Prosty parser robots.txt: reguly Disallow/Allow dla User-agent: *.
//
// Nie implementujemy wildcardow z rozszerzen Google poza '*' i '$',
// bo w BIP-ach praktycznie nie wystepuja, a falszywy Disallow jest
// bezpieczniejszy niz falszywy Allow.

export interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number | null;
}

export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [], crawlDelayMs: null };
  let applies = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      applies = value === "*";
    } else if (applies && key === "disallow" && value) {
      rules.disallow.push(value);
    } else if (applies && key === "allow" && value) {
      rules.allow.push(value);
    } else if (applies && key === "crawl-delay") {
      const seconds = Number(value.replace(",", "."));
      if (Number.isFinite(seconds)) rules.crawlDelayMs = Math.min(seconds * 1000, 30_000);
    }
  }
  return rules;
}

function matches(pattern: string, pathAndQuery: string): boolean {
  if (!pattern.includes("*") && !pattern.endsWith("$")) {
    return pathAndQuery.startsWith(pattern);
  }
  const escaped = pattern
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\$$/, "$");
  return new RegExp(`^${escaped}`).test(pathAndQuery);
}

export function robotsAllows(rules: RobotsRules | null, url: string): boolean {
  if (!rules) return true;
  let target: string;
  try {
    const u = new URL(url);
    target = u.pathname + u.search;
  } catch {
    return false;
  }
  // Najdluzsze dopasowanie wygrywa, remis rozstrzyga Allow.
  let best: { allow: boolean; len: number } = { allow: true, len: -1 };
  for (const p of rules.disallow) {
    if (matches(p, target) && p.length > best.len) best = { allow: false, len: p.length };
  }
  for (const p of rules.allow) {
    if (matches(p, target) && p.length >= best.len) best = { allow: true, len: p.length };
  }
  return best.allow;
}
