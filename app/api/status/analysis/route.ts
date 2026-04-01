import { NextResponse } from "next/server";
import { getAnalysisRuntimeStatus, getLastAnalysisDebugState } from "@/lib/analysis-runtime";

export async function GET() {
  const status = getAnalysisRuntimeStatus();
  const lastEvent = await getLastAnalysisDebugState();

  return NextResponse.json({
    openaiEnabled: status.openaiEnabled,
    mode: status.mode,
    lastEvent
  });
}
