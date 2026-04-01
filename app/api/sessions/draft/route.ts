import { NextResponse } from "next/server";
import { checkAnalyzeRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { buildValidationError, createSessionFromForm, saveSession } from "@/lib/session-service";

export async function POST(request: Request) {
  const rateLimit = checkAnalyzeRateLimit(getRateLimitKey(request));

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  const formData = await request.formData();

  try {
    const session = await createSessionFromForm(formData);
    await saveSession(session);

    return NextResponse.json({
      id: session.id,
      ...session.analysis
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create session.";
    const status = buildValidationError(message) ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
