export function formatCategoryLabel(value: string) {
  const labels: Record<string, string> = {
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

  return labels[value] ??
    value
      .split("/")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" / ");
}

export function formatItemHeading(input: {
  type: "image" | "text";
  note?: string;
  description?: string;
  index: number;
}) {
  if (input.note?.trim()) {
    return input.note.trim();
  }

  if (input.type === "text") {
    return `Text note ${input.index + 1}`;
  }

  const cleanedDescription = input.description
    ?.replace(/^A screenshot (described as|that likely centers on|from the session with)\s*/i, "")
    ?.replace(/\.$/, "")
    ?.trim();

  if (cleanedDescription) {
    return toSentenceCase(cleanedDescription);
  }

  return `Screenshot ${input.index + 1}`;
}

function toSentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
