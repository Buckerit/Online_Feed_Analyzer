import "server-only";

type RateLimitRecord = {
  minuteWindowStart: number;
  minuteCount: number;
  hourWindowStart: number;
  hourCount: number;
};

const RATE_LIMITS = new Map<string, RateLimitRecord>();
const MINUTE_LIMIT = 5;
const HOUR_LIMIT = 20;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export function getRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate = forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "local-dev";

  return `analyze:${candidate}`;
}

export function checkAnalyzeRateLimit(key: string) {
  const now = Date.now();
  const current = RATE_LIMITS.get(key) ?? {
    minuteWindowStart: now,
    minuteCount: 0,
    hourWindowStart: now,
    hourCount: 0
  };

  if (now - current.minuteWindowStart >= MINUTE_MS) {
    current.minuteWindowStart = now;
    current.minuteCount = 0;
  }

  if (now - current.hourWindowStart >= HOUR_MS) {
    current.hourWindowStart = now;
    current.hourCount = 0;
  }

  if (current.minuteCount >= MINUTE_LIMIT || current.hourCount >= HOUR_LIMIT) {
    RATE_LIMITS.set(key, current);

    return {
      allowed: false,
      error: "Too many reflections started too quickly. Please wait a minute and try again."
    };
  }

  current.minuteCount += 1;
  current.hourCount += 1;
  RATE_LIMITS.set(key, current);

  return {
    allowed: true,
    error: null
  };
}
