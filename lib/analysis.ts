import { KEYWORD_MAP } from "@/lib/categories";
import { CATEGORIES } from "@/lib/types";
import type {
  CategoryPercentage,
  ScrollItem,
  SessionAnalysis,
  SessionCategory
} from "@/lib/types";

type DominantSideResult = {
  dominant_side: string;
  dominant_side_description: string;
};

export function classifyTextEntry(text: string): {
  category: SessionCategory;
  keywords: string[];
} {
  const normalized = text.toLowerCase().replace(/[^\w\s/]/g, " ");
  let bestCategory: SessionCategory = "other";
  let bestKeywords: string[] = [];

  for (const category of CATEGORIES) {
    const matched = KEYWORD_MAP[category].filter((keyword) =>
      normalized.includes(keyword)
    );

    if (matched.length > bestKeywords.length) {
      bestCategory = category;
      bestKeywords = matched;
    }
  }

  return { category: bestCategory, keywords: bestKeywords };
}

export function buildLocalItemDescription(input: {
  type: "image" | "text";
  content: string;
  label: string;
  note?: string;
  category: SessionCategory;
}) {
  if (input.type === "image") {
    if (input.note?.trim()) {
      return `A screenshot described as ${input.note.trim()}.`;
    }

    if (input.category === "other") {
      return `A screenshot from the session with a mixed or hard-to-label subject.`;
    }

    return `A screenshot that likely centers on ${formatCategoryPhrase(input.category)} content.`;
  }

  const trimmed = input.content.replace(/\s+/g, " ").trim();
  const snippet = trimmed.length > 110 ? `${trimmed.slice(0, 107)}...` : trimmed;

  return `A note about ${snippet}`;
}

export function deriveLocalItemTraits(category: SessionCategory): string[] {
  const map: Record<SessionCategory, string[]> = {
    memes: ["fast humor", "internet irony"],
    "politics/news": ["reactive tone", "headline energy"],
    "food/lifestyle": ["taste-making", "soft aspirational mood"],
    "friends/social": ["social comparison", "relationship focus"],
    "tech/AI": ["future-facing", "productive-curious"],
    "art/aesthetic": ["visual taste", "composed mood"],
    brainrot: ["chaotic pacing", "mentally crowded"],
    "comfort/cute": ["soft comfort", "gentle reset energy"],
    other: ["mixed signal"]
  };

  return map[category];
}

export function buildLocalSessionAnalysis(items: ScrollItem[]): SessionAnalysis {
  const dominantCategories = ensureMeaningfulCategories(buildDominantCategories(items));
  const styleTraits = dedupeTextList(deriveSessionTraits(items, dominantCategories), 4);
  const notablePatterns = dedupeTextList(deriveNotablePatterns(items, dominantCategories), 3);
  const summary = sanitizeSummaryLines(
    removeNearDuplicateLines(
      buildReadableSummary(dominantCategories, styleTraits, notablePatterns, items),
      4
    ),
    3
  );
  const filteredPatterns = removeNearDuplicateLines(
    notablePatterns.filter(
      (pattern) => !summary.some((sentence) => areSimilarText(pattern, sentence))
    ),
    3
  );
  const sessionTitle = buildSessionTitle(dominantCategories, styleTraits);
  const dominantSide = deriveDominantSide({
    dominantCategories,
    styleTraits,
    notablePatterns: filteredPatterns,
    summary
  });

  return {
    session_title: sessionTitle,
    summary,
    dominant_categories: dominantCategories,
    dominant_side: dominantSide.dominant_side,
    dominant_side_description: dominantSide.dominant_side_description,
    style_traits: styleTraits,
    notable_patterns: filteredPatterns,
    analyzed_items: items.map((item) => ({
      id: item.id,
      label: item.label,
      type: item.type,
      note: item.note,
      category: item.category,
      description: item.assistantAnalysis.description,
      style_traits: item.assistantAnalysis.styleTraits
    }))
  };
}

export function buildDominantCategories(items: ScrollItem[]): CategoryPercentage[] {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<
    SessionCategory,
    number
  >;

  for (const item of items) {
    counts[item.category] += 1;
  }

  return distributePercentages(counts, items.length)
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.percentage - a.percentage || b.count - a.count);
}

export function ensureMeaningfulCategories(dominantCategories: CategoryPercentage[]) {
  if (
    dominantCategories.length > 1 &&
    dominantCategories[0]?.category === "other" &&
    dominantCategories[1]?.count === dominantCategories[0]?.count
  ) {
    return [...dominantCategories.slice(1), dominantCategories[0]];
  }

  return dominantCategories;
}

export function deriveDominantSide(input: {
  dominantCategories: CategoryPercentage[];
  styleTraits: string[];
  notablePatterns: string[];
  summary: string[];
}): DominantSideResult {
  const topPercentage = input.dominantCategories[0]?.percentage ?? 0;
  const tiedCategories = input.dominantCategories
    .filter((entry) => entry.percentage === topPercentage)
    .map((entry) => entry.category);
  const cues = [
    ...input.styleTraits,
    ...input.notablePatterns,
    ...input.summary
  ]
    .join(" ")
    .toLowerCase();

  const chosenCategory =
    chooseCategoryFromTie(tiedCategories, cues) ??
    input.dominantCategories[0]?.category ??
    "other";

  const dominantSide = mapCategoryToDominantSide(chosenCategory, cues);

  return {
    dominant_side: dominantSide,
    dominant_side_description: buildDominantSideDescription(
      dominantSide,
      chosenCategory,
      input.styleTraits,
      input.summary
    )
  };
}

function distributePercentages(
  counts: Record<SessionCategory, number>,
  totalItems: number
): CategoryPercentage[] {
  if (totalItems === 0) {
    return CATEGORIES.map((category) => ({ category, percentage: 0, count: 0 }));
  }

  const raw = CATEGORIES.map((category) => {
    const exact = (counts[category] / totalItems) * 100;
    return {
      category,
      count: counts[category],
      exact,
      percentage: Math.floor(exact)
    };
  });

  let remainder = 100 - raw.reduce((sum, item) => sum + item.percentage, 0);
  raw
    .sort((a, b) => (b.exact % 1) - (a.exact % 1))
    .forEach((item) => {
      if (remainder > 0) {
        item.percentage += 1;
        remainder -= 1;
      }
    });

  return raw.map(({ category, count, percentage }) => ({
    category,
    count,
    percentage
  }));
}

function deriveSessionTraits(items: ScrollItem[], dominantCategories: CategoryPercentage[]) {
  const traitCounts = new Map<string, number>();

  items.forEach((item) => {
    item.assistantAnalysis.styleTraits.forEach((trait) => {
      traitCounts.set(trait, (traitCounts.get(trait) ?? 0) + 1);
    });
  });

  const topCategories = dominantCategories.slice(0, 3).map((entry) => entry.category);

  if (topCategories.includes("politics/news") && topCategories.includes("memes")) {
    traitCounts.set("ironic and reactive", (traitCounts.get("ironic and reactive") ?? 0) + 2);
  }

  if (topCategories.includes("tech/AI")) {
    traitCounts.set("future-facing", (traitCounts.get("future-facing") ?? 0) + 1);
  }

  if (
    topCategories.includes("food/lifestyle") ||
    topCategories.includes("art/aesthetic") ||
    topCategories.includes("comfort/cute")
  ) {
    traitCounts.set("aesthetic and aspirational", (traitCounts.get("aesthetic and aspirational") ?? 0) + 1);
  }

  if (topCategories.includes("brainrot") || dominantCategories.length >= 4) {
    traitCounts.set("fast and mentally crowded", (traitCounts.get("fast and mentally crowded") ?? 0) + 2);
  }

  const ranked = [...traitCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([trait]) => trait);

  return ranked.slice(0, 4);
}

function deriveNotablePatterns(items: ScrollItem[], dominantCategories: CategoryPercentage[]) {
  const patterns: string[] = [];
  const categories = dominantCategories.slice(0, 4).map((entry) => entry.category);

  if (categories.includes("politics/news") && categories.includes("tech/AI")) {
    patterns.push("News and tech appeared together, giving the session a strongly current-events feel.");
  }

  if (categories.includes("memes")) {
    patterns.push("Humor showed up as a regular part of the scroll rather than a one-off interruption.");
  }

  if (categories.includes("food/lifestyle") || categories.includes("art/aesthetic")) {
    patterns.push("Taste and presentation shaped the mood of the session.");
  }

  if (categories.includes("friends/social") || categories.includes("comfort/cute")) {
    patterns.push("Softer social or comforting posts helped balance the louder material.");
  }

  if (categories.includes("memes") && categories.includes("politics/news")) {
    patterns.push("The session mixed jokes with current-events material instead of settling into one tone.");
  } else if (dominantCategories.length >= 4) {
    patterns.push("The session moved quickly across several moods and topics.");
  }

  if (patterns.length < 3) {
    const fallback = items
      .slice(0, 3)
      .map((item) => item.assistantAnalysis.description)
      .filter(Boolean)
      .map((description) => `${description.charAt(0).toUpperCase()}${description.slice(1)}.`);
    patterns.push(...fallback);
  }

  return patterns.slice(0, 3);
}

function buildReadableSummary(
  dominantCategories: CategoryPercentage[],
  styleTraits: string[],
  notablePatterns: string[],
  items: ScrollItem[]
) {
  const [firstCategory, secondCategory, thirdCategory] = dominantCategories;
  const topCategoryText = [firstCategory, secondCategory, thirdCategory]
    .filter(Boolean)
    .map((entry) => formatCategoryPhrase(entry.category))
    .join(", ");
  const primary = dominantCategories[0];
  const secondary = dominantCategories[1];
  const visualTilt = items.some((item) => item.type === "image");
  const dominantPhrase = primary
    ? `${formatCategoryPhrase(primary.category)}${primary.percentage >= 60 ? " most of the time" : ""}`
    : "a mixed set of posts";
  const contrastPhrase = secondary
    ? `A smaller share came from ${formatCategoryPhrase(secondary.category)}, which kept the session from feeling one-note.`
    : "It stayed fairly consistent from start to finish.";
  const texturePhrase = notablePatterns[0] ?? "The overall rhythm felt more visual than argumentative.";
  const closingPhrase = visualTilt
    ? "Taken together, it felt like a visual snapshot of what held your attention in that moment."
    : "Taken together, it read like a quick record of what was on your mind and in your feed.";
  const sentenceOne = `This session leaned toward ${dominantPhrase}, with a ${pickTonePhrase(styleTraits)} tone overall.`;
  const sentenceTwo = primary && secondary
    ? contrastPhrase
    : `Most of the attention stayed with ${topCategoryText || "one main thread"}, which gave the session its center of gravity.`;
  const sentenceThree = texturePhrase;

  return [sentenceOne, sentenceTwo, sentenceThree, closingPhrase].slice(0, 4);
}

function buildSessionTitle(
  dominantCategories: CategoryPercentage[],
  styleTraits: string[]
) {
  const firstCategory = dominantCategories[0]?.category ?? "other";
  const secondCategory = dominantCategories[1]?.category;
  const leadTrait = styleTraits[0] ?? "mixed";

  if (secondCategory) {
    return buildMixedTitle(firstCategory, secondCategory);
  }

  return `${toTitleCase(leadTrait)} ${formatCategoryLabel(firstCategory)} Session`;
}

function chooseCategoryFromTie(categories: SessionCategory[], cues: string) {
  if (categories.length <= 1) {
    return categories[0];
  }

  const cueChecks: Array<{
    category: SessionCategory;
    matches: string[];
  }> = [
    { category: "memes", matches: ["humor", "humorous", "meme", "joke", "irony", "playful"] },
    {
      category: "politics/news",
      matches: ["informative", "news", "headline", "politic", "current event", "reactive"]
    },
    {
      category: "friends/social",
      matches: ["personal", "friend", "relationship", "social", "everyday life"]
    },
    {
      category: "art/aesthetic",
      matches: ["art", "artistic", "visual", "aesthetic", "scenic", "style"]
    },
    {
      category: "tech/AI",
      matches: ["tech", "ai", "future", "informative", "product", "tool"]
    }
  ];

  for (const cueCheck of cueChecks) {
    if (
      categories.includes(cueCheck.category) &&
      cueCheck.matches.some((match) => cues.includes(match))
    ) {
      return cueCheck.category;
    }
  }

  return categories[0];
}

function mapCategoryToDominantSide(category: SessionCategory, cues: string) {
  switch (category) {
    case "memes":
      return "Meme Spiral";
    case "politics/news":
      return cues.includes("hot take") || cues.includes("reactive") ? "Hot Take" : "News Rush";
    case "food/lifestyle":
      return cues.includes("soft") || cues.includes("calm") ? "Soft Escape" : "Hype Loop";
    case "friends/social":
      return "Personal Pocket";
    case "tech/AI":
      return "Tech Pulse";
    case "art/aesthetic":
      return "Art Drift";
    case "brainrot":
      return "Chaos Scroll";
    case "comfort/cute":
      return cues.includes("cozy") || cues.includes("comfort") ? "Cozy Core" : "Soft Escape";
    case "other":
    default:
      if (cues.includes("humor") || cues.includes("meme")) {
        return "Meme Spiral";
      }
      if (cues.includes("news") || cues.includes("politic") || cues.includes("headline")) {
        return "News Rush";
      }
      if (cues.includes("personal") || cues.includes("friend") || cues.includes("social")) {
        return "Personal Pocket";
      }
      if (cues.includes("art") || cues.includes("aesthetic") || cues.includes("visual")) {
        return "Art Drift";
      }
      if (cues.includes("tech") || cues.includes("ai") || cues.includes("future")) {
        return "Tech Pulse";
      }
      if (cues.includes("cozy") || cues.includes("comfort") || cues.includes("soft")) {
        return "Cozy Core";
      }
      if (cues.includes("opinion") || cues.includes("reactive")) {
        return "Hot Take";
      }
      return "Chaos Scroll";
  }
}

function buildDominantSideDescription(
  dominantSide: string,
  category: SessionCategory,
  styleTraits: string[],
  summary: string[]
) {
  const leadTraits = styleTraits.slice(0, 2).join(", ");
  const summaryText = summary.join(" ").toLowerCase();

  const baseDescriptions: Record<string, string> = {
    "Meme Spiral": "Humor-heavy, quick to land, and driven by playful posts that set the pace.",
    "News Rush": "Current events and information carried the session more than everything else.",
    "Chaos Scroll": "The feed kept jumping across moods and references, making the session feel fast and unruly.",
    "Art Drift": "Visual style and aesthetic cues did more of the work than commentary or debate.",
    "Tech Pulse": "Tech and AI posts gave the session a forward-looking, information-first center.",
    "Personal Pocket": "Social and personal cues made the feed feel closer to everyday life than public discourse.",
    "Soft Escape": "Lighter, gentler posts turned the scroll into a brief break from louder material.",
    "Hype Loop": "Attention-grabbing lifestyle or promotional energy kept the session keyed up and momentum-driven.",
    "Cozy Core": "Comforting visuals and softer moods gave the session a calmer, more restorative feel.",
    "Hot Take": "Opinionated, reactive posts gave the feed a sharper debate-heavy edge."
  };

  if (leadTraits && !summaryText.includes(leadTraits)) {
    return `${baseDescriptions[dominantSide]} The tone read as ${leadTraits}.`;
  }

  if (category === "other" && summary[0]) {
    return summary[0];
  }

  return baseDescriptions[dominantSide];
}

function formatCategoryPhrase(category: SessionCategory) {
  const map: Record<SessionCategory, string> = {
    memes: "memes and jokes",
    "politics/news": "politics and news",
    "food/lifestyle": "food and lifestyle content",
    "friends/social": "social and relationship content",
    "tech/AI": "tech and AI posts",
    "art/aesthetic": "art and aesthetic content",
    brainrot: "chaotic internet detours",
    "comfort/cute": "comfort and cute content",
    other: "mixed posts"
  };

  return map[category];
}

function formatCategoryLabel(category: SessionCategory) {
  const labels: Record<SessionCategory, string> = {
    memes: "Memes / Humor",
    "politics/news": "News / Politics",
    "food/lifestyle": "Food / Lifestyle",
    "friends/social": "Friends / Social",
    "tech/AI": "Tech / AI",
    "art/aesthetic": "Art / Aesthetic",
    brainrot: "Brainrot / Chaos",
    "comfort/cute": "Comfort / Cute",
    other: "Mixed / Other"
  };

  return labels[category];
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function dedupeTextList(values: string[], maxItems: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.map((entry) => entry.trim()).filter(Boolean)) {
    const normalized = value.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(value);

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

export function sanitizeSummaryLines(values: string[], maxItems: number) {
  const cleaned = removeNearDuplicateLines(
    values.filter((value) => !looksLikeItemByItemRecap(value)),
    maxItems
  );

  if (cleaned.length > 0) {
    return cleaned.slice(0, maxItems);
  }

  return removeNearDuplicateLines(values, maxItems).slice(0, maxItems);
}

function buildMixedTitle(firstCategory: SessionCategory, secondCategory: SessionCategory) {
  const pairTitles: Record<string, string> = {
    "tech/AI|memes": "Tech, Humor, and Scroll Energy",
    "memes|politics/news": "Humor with a Current-Events Edge",
    "politics/news|memes": "Humor with a Current-Events Edge",
    "art/aesthetic|tech/AI": "Visual Culture with a Tech Lean",
    "food/lifestyle|friends/social": "Lifestyle Posts and Social Drift"
  };

  const key = `${firstCategory}|${secondCategory}`;
  const reverseKey = `${secondCategory}|${firstCategory}`;

  return (
    pairTitles[key] ??
    pairTitles[reverseKey] ??
    `${formatCategoryLabel(firstCategory)} with ${formatCategoryLabel(secondCategory)}`
  );
}

function pickTonePhrase(styleTraits: string[]) {
  if (styleTraits.length === 0) {
    return "mixed";
  }

  if (styleTraits.length === 1) {
    return styleTraits[0];
  }

  return `${styleTraits[0]} and ${styleTraits[1]}`;
}

function areSimilarText(a: string, b: string) {
  const aTokens = normalizeForSimilarity(a);
  const bTokens = normalizeForSimilarity(b);

  if (aTokens.size === 0 || bTokens.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      overlap += 1;
    }
  }

  const similarity = overlap / Math.max(aTokens.size, bTokens.size);
  return similarity >= 0.6;
}

function normalizeForSimilarity(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function removeNearDuplicateLines(values: string[], maxItems: number) {
  const result: string[] = [];

  for (const value of values.map((entry) => entry.trim()).filter(Boolean)) {
    if (result.some((existing) => areSimilarText(existing, value))) {
      continue;
    }

    result.push(value);

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

function looksLikeItemByItemRecap(value: string) {
  const normalized = value.toLowerCase();

  const recapPatterns = [
    /^the (meme|photo|image|illustration|screenshot|post|reel)\b/,
    /^alongside this\b/,
    /\bwhile the\b/,
    /\bbrings a sense of\b/,
    /\badds a playful touch\b/,
    /\bsparks a sense of\b/
  ];

  return recapPatterns.some((pattern) => pattern.test(normalized));
}
