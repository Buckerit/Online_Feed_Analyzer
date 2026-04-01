import "server-only";
import { promises as fs } from "fs";
import path from "path";

export type AnalysisMode = "openai" | "local";
type AnalysisDebugState = {
  event: string;
  openaiKeyPresent: boolean;
  mode: AnalysisMode;
  model: string;
  chosenPath?: string;
  schemaName?: string;
  timestamp: string;
};

let lastAnalysisDebugState: AnalysisDebugState | null = null;
const analysisDebugFile = path.join(process.cwd(), "data", "analysis-status.json");

export function isOpenAIEnabled() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return Boolean(apiKey);
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || process.env.OPENAI_ANALYSIS_MODEL?.trim() || "gpt-4.1-mini";
}

export function getAnalysisRuntimeStatus(): {
  openaiEnabled: boolean;
  mode: AnalysisMode;
  model: string;
} {
  const openaiEnabled = isOpenAIEnabled();

  return {
    openaiEnabled,
    mode: openaiEnabled ? "openai" : "local",
    model: getOpenAIModel()
  };
}

export function logAnalysisStatus(event: string, details?: Record<string, unknown>) {
  const status = getAnalysisRuntimeStatus();

  const payload: AnalysisDebugState = {
    event,
    openaiKeyPresent: status.openaiEnabled,
    mode: status.mode,
    model: status.model,
    chosenPath: typeof details?.chosenPath === "string" ? details.chosenPath : undefined,
    schemaName: typeof details?.schemaName === "string" ? details.schemaName : undefined,
    timestamp: new Date().toISOString()
  };

  lastAnalysisDebugState = payload;
  void persistAnalysisDebugState(payload);
  console.info("[analysis-runtime]", {
    ...payload,
    ...details
  });
}

export async function getLastAnalysisDebugState() {
  if (lastAnalysisDebugState) {
    return lastAnalysisDebugState;
  }

  try {
    const raw = await fs.readFile(analysisDebugFile, "utf8");
    const sanitized = raw.replace(/^\uFEFF/, "");
    return JSON.parse(sanitized) as AnalysisDebugState;
  } catch {
    return null;
  }
}

async function persistAnalysisDebugState(payload: AnalysisDebugState) {
  try {
    await fs.mkdir(path.dirname(analysisDebugFile), { recursive: true });
    await fs.writeFile(analysisDebugFile, JSON.stringify(payload, null, 2), "utf8");
  } catch (error) {
    console.error("[analysis-runtime] failed to persist debug state", error);
  }
}
