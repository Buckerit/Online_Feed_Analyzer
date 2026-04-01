import {
  dedupeTextList,
  buildDominantCategories,
  buildLocalSessionAnalysis,
  deriveDominantSide,
  ensureMeaningfulCategories,
  sanitizeSummaryLines
} from "@/lib/analysis";
import {
  getAnalysisRuntimeStatus,
  isOpenAIEnabled,
  logAnalysisStatus
} from "@/lib/analysis-runtime";
import { CATEGORIES } from "@/lib/types";
import type {
  ScrollItem,
  SessionAnalysis,
  SessionCategory
} from "@/lib/types";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

type ItemAIResult = {
  description: string;
  category: SessionCategory;
  style_traits: string[];
};

type BatchImageAIResult = {
  items: Array<
    ItemAIResult & {
      item_id: string;
    }
  >;
};

type BatchTextAIResult = {
  items: Array<
    ItemAIResult & {
      item_id: string;
    }
  >;
};

type SessionAIResult = {
  session_title: string;
  summary: string[];
  style_traits: string[];
  notable_patterns: string[];
};

type AnalysisSource = "openai" | "local";

type AnalysisResult<T> = {
  source: AnalysisSource;
  data: T | null;
};

const CATEGORY_ENUM: SessionCategory[] = [...CATEGORIES];

export function isOpenAIAnalysisEnabled() {
  return isOpenAIEnabled();
}

export async function analyzeImageWithOpenAI(input: {
  fileName: string;
  mimeType: string;
  base64Data: string;
  note?: string;
}): Promise<AnalysisResult<ItemAIResult>> {
  return createStructuredResponse<ItemAIResult>({
    schemaName: "scroll_image_item_analysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        description: {
          type: "string",
          description: "A short neutral description of the visible content."
        },
        category: {
          type: "string",
          enum: CATEGORY_ENUM
        },
        style_traits: {
          type: "array",
          items: { type: "string" },
          maxItems: 3
        }
      },
      required: ["description", "category", "style_traits"]
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You analyze social-media screenshots for a reflective media journal. Use the screenshot and the user's note together. Prefer specific plain language. Distinguish memes or humor from news or current events when both are plausible. Never infer mental health, personality diagnosis, trauma, identity, or sensitive traits."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analyze this screenshot named ${input.fileName}.${input.note?.trim() ? ` User note: ${input.note.trim()}.` : ""} Return one category, one short natural description, and a few concrete tags. Avoid vague filler.`
          },
          {
            type: "input_image",
            image_url: `data:${input.mimeType};base64,${input.base64Data}`
          }
        ]
      }
    ]
  });
}

export async function analyzeImagesWithOpenAI(
  inputs: Array<{
    itemId: string;
    fileName: string;
    mimeType: string;
    base64Data: string;
    note?: string;
  }>
): Promise<AnalysisResult<Map<string, ItemAIResult>>> {
  if (inputs.length === 0) {
    return {
      source: isOpenAIEnabled() ? "openai" : "local",
      data: new Map()
    };
  }

  const aiResponse = await createStructuredResponse<BatchImageAIResult>({
    schemaName: "scroll_image_batch_analysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              item_id: {
                type: "string"
              },
              description: {
                type: "string",
                description: "A short neutral description of the visible content."
              },
              category: {
                type: "string",
                enum: CATEGORY_ENUM
              },
              style_traits: {
                type: "array",
                items: { type: "string" },
                maxItems: 3
              }
            },
            required: ["item_id", "description", "category", "style_traits"]
          }
        }
      },
      required: ["items"]
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You analyze batches of social-media screenshots for a reflective media journal. Use the image and the user's note together. Prefer specific plain language. Distinguish memes or humor from news or current events when both are plausible. Never infer mental health, personality diagnosis, trauma, identity, or sensitive traits."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analyze each screenshot in this batch. Return one object for each item_id in the same session.\n\nItems:\n${JSON.stringify(
              inputs.map((input) => ({
                item_id: input.itemId,
                file_name: input.fileName,
                note: input.note ?? ""
              })),
              null,
              2
            )}`
          },
          ...inputs.flatMap((input) => [
            {
              type: "input_text" as const,
              text: `item_id: ${input.itemId}\nfile_name: ${input.fileName}\nnote: ${input.note?.trim() || "none"}`
            },
            {
              type: "input_image" as const,
              image_url: `data:${input.mimeType};base64,${input.base64Data}`
            }
          ])
        ]
      }
    ]
  });

  if (!aiResponse.data) {
    return {
      source: aiResponse.source,
      data: new Map()
    };
  }

  return {
    source: aiResponse.source,
    data: new Map(
      aiResponse.data.items.map((item) => [
        item.item_id,
        {
          description: item.description,
          category: item.category,
          style_traits: item.style_traits
        }
      ])
    )
  };
}

export async function analyzeTextWithOpenAI(text: string): Promise<AnalysisResult<ItemAIResult>> {
  return createStructuredResponse<ItemAIResult>({
    schemaName: "scroll_text_item_analysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        description: {
          type: "string",
          description: "A short neutral description of the note's content."
        },
        category: {
          type: "string",
          enum: CATEGORY_ENUM
        },
        style_traits: {
          type: "array",
          items: { type: "string" },
          maxItems: 3
        }
      },
      required: ["description", "category", "style_traits"]
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You analyze short notes that describe social-media posts. Keep the analysis lightweight and thematic. Do not make psychological or sensitive-personal inferences."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analyze this note from a social-media scroll session:\n\n${text}\n\nReturn one category, one short natural description, and a few concrete tags. Avoid vague filler.`
          }
        ]
      }
    ]
  });
}

export async function analyzeTextsWithOpenAI(
  inputs: Array<{
    itemId: string;
    text: string;
  }>
): Promise<AnalysisResult<Map<string, ItemAIResult>>> {
  if (inputs.length === 0) {
    return {
      source: isOpenAIEnabled() ? "openai" : "local",
      data: new Map()
    };
  }

  const aiResponse = await createStructuredResponse<BatchTextAIResult>({
    schemaName: "scroll_text_batch_analysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              item_id: { type: "string" },
              description: { type: "string" },
              category: {
                type: "string",
                enum: CATEGORY_ENUM
              },
              style_traits: {
                type: "array",
                items: { type: "string" },
                maxItems: 3
              }
            },
            required: ["item_id", "description", "category", "style_traits"]
          }
        }
      },
      required: ["items"]
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You analyze batches of short notes about social-media posts for a reflective media journal. Prefer specific plain language. Distinguish memes or humor from news or current events when both are plausible. Return one result per item_id."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analyze each note in this batch and return one object per item_id.\n\n${JSON.stringify(
              inputs,
              null,
              2
            )}`
          }
        ]
      }
    ]
  });

  if (!aiResponse.data) {
    return {
      source: aiResponse.source,
      data: new Map()
    };
  }

  return {
    source: aiResponse.source,
    data: new Map(
      aiResponse.data.items.map((item) => [
        item.item_id,
        {
          description: item.description,
          category: item.category,
          style_traits: item.style_traits
        }
      ])
    )
  };
}

export async function buildSessionNarrativeWithOpenAI(
  items: ScrollItem[]
): Promise<AnalysisResult<SessionAnalysis>> {
  const dominantCategories = ensureMeaningfulCategories(buildDominantCategories(items));
  const payload = items.map((item) => ({
    label: item.label,
    type: item.type,
    note: item.note,
    category: item.category,
    description: item.assistantAnalysis.description,
    style_traits: item.assistantAnalysis.styleTraits
  }));

  const aiSummary = await createStructuredResponse<SessionAIResult>({
    schemaName: "scroll_session_analysis",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        session_title: {
          type: "string",
          description: "A short readable title for the session."
        },
        summary: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 5
        },
        style_traits: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 4
        },
        notable_patterns: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: 3
        }
      },
      required: ["session_title", "summary", "style_traits", "notable_patterns"]
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You write readable session-level summaries for a digital reflection tool. Use plain human language, not analyst jargon. Write a short title, a 2 to 3 sentence reflective summary, 2 to 4 meaningful tags, and 2 to 3 supporting observations. The summary should describe the overall feel of the session, not recap each individual item one by one. Do not write one sentence per image. Avoid lines that begin with phrases like 'The meme', 'The photo', 'The image', or 'Alongside this'. Avoid repeating the same idea across sections. Never use the phrase 'circling back' or 'No clear theme inferred'."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Using these analyzed items, user notes, and category percentages, write the final session analysis JSON.\n\nDominant categories:\n${JSON.stringify(
              dominantCategories,
              null,
              2
            )}\n\nItems:\n${JSON.stringify(payload, null, 2)}`
          }
        ]
      }
    ]
  });

  if (!aiSummary.data) {
    return {
      source: aiSummary.source,
      data: null
    };
  }

  const summary = sanitizeSummaryLines(removeNearDuplicateLines(aiSummary.data.summary, 4), 3);
  const styleTraits = dedupeTextList(aiSummary.data.style_traits, 4);
  const notablePatterns = removeNearDuplicateLines(
    aiSummary.data.notable_patterns.filter(
      (pattern) => !summary.some((summarySentence) => areSimilarText(summarySentence, pattern))
    ),
    3
  );
  const dominantSide = deriveDominantSide({
    dominantCategories,
    styleTraits,
    notablePatterns,
    summary
  });

  return {
    source: aiSummary.source,
    data: {
      session_title: aiSummary.data.session_title,
      summary,
      dominant_categories: dominantCategories,
      dominant_side: dominantSide.dominant_side,
      dominant_side_description: dominantSide.dominant_side_description,
      style_traits: styleTraits,
      notable_patterns: notablePatterns,
      analyzed_items: items.map((item) => ({
        id: item.id,
        label: item.label,
        type: item.type,
        note: item.note,
        category: item.category,
        description: item.assistantAnalysis.description,
        style_traits: item.assistantAnalysis.styleTraits
      }))
    }
  };
}

export function buildSessionAnalysis(items: ScrollItem[]) {
  return buildLocalSessionAnalysis(items);
}

async function createStructuredResponse<T>({
  schemaName,
  schema,
  input
}: {
  schemaName: string;
  schema: object;
  input: unknown[];
}): Promise<AnalysisResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const runtimeStatus = getAnalysisRuntimeStatus();

  if (!apiKey) {
    logAnalysisStatus("openai-disabled", { chosenPath: "local" });
    return {
      source: "local",
      data: null
    };
  }

  try {
    logAnalysisStatus("openai-request-start", { chosenPath: "openai", schemaName });
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: runtimeStatus.model,
        input,
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema
          }
        }
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      console.error("OpenAI analysis request failed", await response.text());
      logAnalysisStatus("openai-request-failed", { chosenPath: "local", schemaName });
      return {
        source: "local",
        data: null
      };
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      }>;
    };
    const outputText =
      payload.output_text ??
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === "output_text" && item.text)?.text;

    if (!outputText) {
      logAnalysisStatus("openai-empty-output", { chosenPath: "local", schemaName });
      return {
        source: "local",
        data: null
      };
    }

    logAnalysisStatus("openai-request-succeeded", { chosenPath: "openai", schemaName });
    return {
      source: "openai",
      data: JSON.parse(outputText) as T
    };
  } catch (error) {
    console.error("OpenAI analysis unavailable; falling back to local mode", error);
    logAnalysisStatus("openai-request-exception", { chosenPath: "local", schemaName });
    return {
      source: "local",
      data: null
    };
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function areSimilarText(a: string, b: string) {
  const aTokens = new Set(normalizeText(a).split(" ").filter((token) => token.length > 2));
  const bTokens = new Set(normalizeText(b).split(" ").filter((token) => token.length > 2));

  if (aTokens.size === 0 || bTokens.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(aTokens.size, bTokens.size) >= 0.6;
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
