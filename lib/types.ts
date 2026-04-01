export const CATEGORIES = [
  "memes",
  "politics/news",
  "food/lifestyle",
  "friends/social",
  "tech/AI",
  "art/aesthetic",
  "brainrot",
  "comfort/cute",
  "other"
] as const;

export type SessionCategory = (typeof CATEGORIES)[number];
export type SessionStatus = "complete";
export type ItemSource = "openai" | "local";

export interface ItemAssistantAnalysis {
  provider: ItemSource;
  description: string;
  suggestedCategory: SessionCategory;
  styleTraits: string[];
}

export interface ScrollItem {
  id: string;
  type: "image" | "text";
  label: string;
  content: string;
  note?: string;
  category: SessionCategory;
  source: ItemSource;
  assistantAnalysis: ItemAssistantAnalysis;
}

export interface CategoryPercentage {
  category: SessionCategory;
  percentage: number;
  count: number;
}

export interface AnalyzedItemSummary {
  id: string;
  label: string;
  type: "image" | "text";
  note?: string;
  category: SessionCategory;
  description: string;
  style_traits: string[];
}

export interface SessionAnalysis {
  session_title: string;
  summary: string[];
  dominant_categories: CategoryPercentage[];
  dominant_side: string;
  dominant_side_description: string;
  style_traits: string[];
  notable_patterns: string[];
  analyzed_items: AnalyzedItemSummary[];
}

export interface ScrollSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  items: ScrollItem[];
  analysis: SessionAnalysis;
}
