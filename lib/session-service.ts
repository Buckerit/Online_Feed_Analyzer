import path from "path";
import { randomUUID } from "crypto";
import {
  buildLocalItemDescription,
  buildLocalSessionAnalysis,
  classifyTextEntry,
  deriveLocalItemTraits
} from "@/lib/analysis";
import {
  analyzeImagesWithOpenAI,
  analyzeTextsWithOpenAI,
  buildSessionNarrativeWithOpenAI
} from "@/lib/openai-analysis";
import {
  deleteSessionRecord,
  getSessions,
  saveSessions,
  writeUpload
} from "@/lib/storage";
import type { ScrollItem, ScrollSession, SessionCategory } from "@/lib/types";

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
const imageMimeTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif"
};

export function buildValidationError(message: string) {
  return /provide|empty|missing|supported/i.test(message);
}

export async function createSessionFromForm(formData: FormData): Promise<ScrollSession> {
  const descriptionsRaw = String(formData.get("descriptions") ?? "");
  const imageNotes = formData.getAll("imageNotes").map((entry) => String(entry ?? "").trim());
  const images = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File);

  if (images.length === 0 && descriptionsRaw.trim().length === 0) {
    throw new Error("Provide at least one screenshot or one text note.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const items: ScrollItem[] = [];
  const descriptions = descriptionsRaw
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const textDrafts = descriptions.map((description, index) => ({
    itemId: randomUUID(),
    index,
    description,
    localCategory: classifyTextEntry(description).category
  }));
  const imageDrafts: Array<{
    itemId: string;
    fileName: string;
    mimeType: string;
    base64Data: string;
    content: string;
    note: string;
    localCategory: SessionCategory;
  }> = [];

  for (const [index, image] of images.entries()) {
    if (image.size === 0) {
      continue;
    }

    const ext = path.extname(image.name).toLowerCase();
    if (!imageExtensions.has(ext)) {
      throw new Error(`Unsupported image type for ${image.name}.`);
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const safeName = `${id}-${randomUUID()}${ext}`;
    const content = await writeUpload(safeName, buffer, imageMimeTypes[ext] ?? "image/png");
    const note = imageNotes[index] ?? "";
    const localCategory = classifyTextEntry(
      `${image.name.replace(/[_-]+/g, " ")} ${note}`.trim()
    ).category;
    const itemId = randomUUID();

    imageDrafts.push({
      itemId,
      fileName: image.name,
      mimeType: imageMimeTypes[ext] ?? "image/png",
      base64Data: buffer.toString("base64"),
      content,
      note,
      localCategory
    });
  }

  const imageAnalyses = await analyzeImagesWithOpenAI(imageDrafts);
  const imageAnalysisMap = imageAnalyses.data ?? new Map();
  const textAnalyses = await analyzeTextsWithOpenAI(
    textDrafts.map((draft) => ({
      itemId: draft.itemId,
      text: draft.description
    }))
  );
  const textAnalysisMap = textAnalyses.data ?? new Map();

  for (const imageDraft of imageDrafts) {
    const aiAnalysis = imageAnalysisMap.get(imageDraft.itemId);
    const category = aiAnalysis?.category ?? imageDraft.localCategory;

    items.push({
      id: imageDraft.itemId,
      type: "image",
      label: imageDraft.fileName,
      content: imageDraft.content,
      note: imageDraft.note,
      category,
      source: aiAnalysis && imageAnalyses.source === "openai" ? "openai" : "local",
      assistantAnalysis: {
        provider: aiAnalysis && imageAnalyses.source === "openai" ? "openai" : "local",
        description:
          aiAnalysis?.description ??
          buildLocalItemDescription({
            type: "image",
            content: imageDraft.content,
            label: imageDraft.fileName,
            note: imageDraft.note,
            category
          }),
        suggestedCategory: category,
        styleTraits: aiAnalysis?.style_traits?.slice(0, 3) ?? deriveLocalItemTraits(category)
      }
    });
  }

  for (const draft of textDrafts) {
    const aiAnalysis = textAnalysisMap.get(draft.itemId);
    const category = aiAnalysis?.category ?? draft.localCategory;

    items.push({
      id: draft.itemId,
      type: "text",
      label: `Text note ${draft.index + 1}`,
      content: draft.description,
      category,
      source: aiAnalysis && textAnalyses.source === "openai" ? "openai" : "local",
      assistantAnalysis: {
        provider: aiAnalysis && textAnalyses.source === "openai" ? "openai" : "local",
        description:
          aiAnalysis?.description ??
          buildLocalItemDescription({
            type: "text",
            content: draft.description,
            label: `Text note ${draft.index + 1}`,
            category
          }),
        suggestedCategory: category,
        styleTraits: aiAnalysis?.style_traits?.slice(0, 3) ?? deriveLocalItemTraits(category)
      }
    });
  }

  const aiSessionAnalysis = await buildSessionNarrativeWithOpenAI(items);
  const analysis = aiSessionAnalysis.data ?? buildLocalSessionAnalysis(items);

  return {
    id,
    name: analysis.session_title,
    createdAt: now,
    updatedAt: now,
    status: "complete",
    items,
    analysis
  };
}

export async function saveSession(session: ScrollSession) {
  const sessions = await getSessions();
  sessions.push(session);
  await saveSessions(sessions);
}

export async function deleteSession(id: string) {
  return deleteSessionRecord(id);
}

export function getCategoryPercentageMap(items: ScrollItem[]) {
  const counts = new Map<SessionCategory, number>();
  items.forEach((item) => {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  });
  return counts;
}
