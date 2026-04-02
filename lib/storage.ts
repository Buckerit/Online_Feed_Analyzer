import { promises as fs } from "fs";
import path from "path";
import { buildLocalSessionAnalysis, deriveDominantSide } from "@/lib/analysis";
import { CATEGORIES } from "@/lib/types";
import type { ItemSource, ScrollItem, ScrollSession, SessionCategory } from "@/lib/types";

const isVercelRuntime = Boolean(process.env.VERCEL);
const dataDir = isVercelRuntime
  ? path.join("/tmp", "scroll-session-analyzer")
  : path.join(process.cwd(), "data");
const uploadsDir = path.join(process.cwd(), "public", "uploads");
const sessionsFile = path.join(dataDir, "sessions.json");

async function ensureStorage() {
  await fs.mkdir(dataDir, { recursive: true });

  if (!isVercelRuntime) {
    await fs.mkdir(uploadsDir, { recursive: true });
  }

  try {
    await fs.access(sessionsFile);
  } catch {
    await fs.writeFile(sessionsFile, "[]", "utf8");
  }
}

function parseSessionsJson(raw: string) {
  const sanitized = raw.replace(/^\uFEFF/, "").trim();

  try {
    return JSON.parse(sanitized) as ScrollSession[];
  } catch (error) {
    const recovered = extractFirstJsonArray(sanitized);

    if (!recovered) {
      throw error;
    }

    console.error("Recovered sessions.json from trailing invalid content.");
    return JSON.parse(recovered) as ScrollSession[];
  }
}

export async function getSessions(): Promise<ScrollSession[]> {
  await ensureStorage();
  const raw = await fs.readFile(sessionsFile, "utf8");
  const sessions = parseSessionsJson(raw).map(normalizeSession);

  return sessions.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getSessionById(id: string) {
  const sessions = await getSessions();
  return sessions.find((session) => session.id === id) ?? null;
}

export async function saveSessions(sessions: ScrollSession[]) {
  await ensureStorage();
  const tempFile = `${sessionsFile}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(sessions, null, 2), "utf8");
  await fs.rename(tempFile, sessionsFile);
}

export async function writeUpload(fileName: string, buffer: Buffer, mimeType: string) {
  if (isVercelRuntime) {
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  await ensureStorage();
  const fullPath = path.join(uploadsDir, fileName);
  await fs.writeFile(fullPath, buffer);

  return `/uploads/${fileName}`;
}

export async function deleteSessionRecord(id: string) {
  const sessions = await getSessions();
  const session = sessions.find((entry) => entry.id === id);

  if (!session) {
    return false;
  }

  const remaining = sessions.filter((entry) => entry.id !== id);
  await Promise.all(
    session.items
      .filter((item) => item.type === "image")
      .map(async (item) => {
        if (!item.content.startsWith("/")) {
          return;
        }

        const relativePath = item.content.replace(/^\/+/, "").replaceAll("/", path.sep);
        const absolutePath = path.join(process.cwd(), "public", relativePath);

        try {
          await fs.unlink(absolutePath);
        } catch {
          // Ignore missing files so session deletion still succeeds.
        }
      })
  );
  await saveSessions(remaining);

  return true;
}

function normalizeSession(session: ScrollSession): ScrollSession {
  const normalizedItems: ScrollItem[] = session.items.map((item) => {
    const category = (item.category ?? "other") as SessionCategory;
    const legacyAssistantAnalysis = item.assistantAnalysis as
      | {
          description?: string;
          styleTraits?: string[];
          styleTags?: string[];
        }
      | undefined;
    const description =
      legacyAssistantAnalysis?.description ??
      (item.type === "image"
        ? `A screenshot related to ${formatCategoryPhrase(category)}.`
        : `A note about ${item.content.replace(/\s+/g, " ").trim()}.`);

    const source: ItemSource = item.source === "openai" ? "openai" : "local";

    return {
      ...item,
      category,
      source,
      note: item.note,
      assistantAnalysis: {
        provider: source,
        description,
        suggestedCategory: category,
        styleTraits: legacyAssistantAnalysis?.styleTraits ?? legacyAssistantAnalysis?.styleTags ?? []
      }
    };
  });

  const normalizedAnalysis = session.analysis?.dominant_categories
    ? {
        ...session.analysis,
        analyzed_items:
          session.analysis.analyzed_items?.length > 0
            ? session.analysis.analyzed_items
            : normalizedItems.map((item) => ({
              id: item.id,
              label: item.label,
              type: item.type,
              note: item.note,
              category: item.category,
              description: item.assistantAnalysis.description,
              style_traits: item.assistantAnalysis.styleTraits
              }))
      }
    : buildLocalSessionAnalysis(normalizedItems);
  const dominantSide = deriveDominantSide({
    dominantCategories: normalizedAnalysis.dominant_categories,
    styleTraits: normalizedAnalysis.style_traits,
    notablePatterns: normalizedAnalysis.notable_patterns,
    summary: normalizedAnalysis.summary
  });

  return {
    ...session,
    name: normalizedAnalysis.session_title || session.name,
    status: "complete",
    items: normalizedItems,
    analysis: {
      ...normalizedAnalysis,
      dominant_side: normalizedAnalysis.dominant_side ?? dominantSide.dominant_side,
      dominant_side_description:
        normalizedAnalysis.dominant_side_description ?? dominantSide.dominant_side_description,
      dominant_categories: normalizeDominantCategories(normalizedAnalysis.dominant_categories)
    }
  };
}

function normalizeDominantCategories(
  dominantCategories: ScrollSession["analysis"]["dominant_categories"]
) {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<
    SessionCategory,
    number
  >;

  dominantCategories.forEach((entry) => {
    counts[entry.category] = entry.count;
  });

  const total = dominantCategories.reduce((sum, entry) => sum + entry.count, 0);

  if (total === 0) {
    return dominantCategories;
  }

  return dominantCategories.map((entry) => ({
    ...entry,
    percentage: Math.round((entry.count / total) * 100)
  }));
}

function formatCategoryPhrase(category: SessionCategory) {
  const map: Record<SessionCategory, string> = {
    memes: "memes and jokes",
    "politics/news": "politics and news",
    "food/lifestyle": "food and lifestyle posts",
    "friends/social": "social and relationship content",
    "tech/AI": "tech and AI posts",
    "art/aesthetic": "art and aesthetic content",
    brainrot: "chaotic internet posts",
    "comfort/cute": "comfort and cute content",
    other: "mixed content"
  };

  return map[category];
}

function extractFirstJsonArray(raw: string) {
  let depth = 0;
  let inString = false;
  let isEscaped = false;
  let started = false;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];

    if (!started) {
      if (character === "[") {
        started = true;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "[") {
      depth += 1;
      continue;
    }

    if (character === "]") {
      depth -= 1;

      if (depth === 0) {
        return raw.slice(raw.indexOf("["), index + 1);
      }
    }
  }

  return null;
}
