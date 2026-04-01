import { CATEGORIES, type SessionCategory } from "@/lib/types";

export const CATEGORY_OPTIONS: Array<{ value: SessionCategory; label: string }> =
  CATEGORIES.map((category) => ({
    value: category,
    label: category
  }));

export const KEYWORD_MAP: Record<SessionCategory, string[]> = {
  memes: [
    "meme",
    "reaction image",
    "shitpost",
    "funny",
    "joke",
    "lol",
    "template",
    "humor",
    "comedy",
    "satire",
    "caption meme",
    "absurd",
    "reel joke"
  ],
  "politics/news": [
    "politics",
    "election",
    "news",
    "headline",
    "policy",
    "government",
    "war",
    "protest",
    "breaking",
    "economy",
    "layoffs",
    "current events",
    "journalist",
    "cnn",
    "bbc"
  ],
  "food/lifestyle": [
    "recipe",
    "meal",
    "latte",
    "food",
    "fashion",
    "travel",
    "wellness",
    "interior",
    "skincare"
  ],
  "friends/social": [
    "friend",
    "group chat",
    "party",
    "hangout",
    "dating",
    "selfie",
    "birthday",
    "relationship",
    "boyfriend",
    "girlfriend"
  ],
  "tech/AI": [
    "ai",
    "tech",
    "startup",
    "llm",
    "gadget",
    "chip",
    "hardware",
    "benchmark",
    "productivity"
  ],
  "art/aesthetic": [
    "art",
    "painting",
    "design",
    "aesthetic",
    "cinema",
    "gallery",
    "photography",
    "typography"
  ],
  brainrot: [
    "brainrot",
    "slop",
    "nonsense",
    "absurd",
    "surreal",
    "unhinged",
    "doomscroll",
    "deep fried",
    "chaos",
    "cursed"
  ],
  "comfort/cute": ["cute", "cat", "dog", "cozy", "comfort", "plush", "soft", "wholesome", "baking", "gentle", "pets"],
  other: []
};
