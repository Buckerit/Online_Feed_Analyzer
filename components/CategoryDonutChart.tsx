import { formatCategoryLabel } from "@/lib/format";
import type { CategoryPercentage } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  memes: "#F97360",
  "politics/news": "#4F7CFF",
  "food/lifestyle": "#F5A524",
  "friends/social": "#2BB6A8",
  "tech/AI": "#5B8DEF",
  "art/aesthetic": "#A66BFF",
  brainrot: "#E85D75",
  "comfort/cute": "#88C057",
  other: "#94A3B8"
};

type ChartSlice = {
  key: string;
  label: string;
  percentage: number;
  color: string;
};

export function CategoryDonutChart({
  categories
}: {
  categories: CategoryPercentage[];
}) {
  const chartData = buildChartData(categories);
  const { slices, otherBreakdown } = chartData;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-chart-layout">
      <div className="donut-chart-wrap" aria-hidden="true">
        <svg viewBox="0 0 180 180" className="donut-chart-svg">
          <circle cx="90" cy="90" r={radius} className="donut-track" />
          {slices.map((slice) => {
            const dash = (slice.percentage / 100) * circumference;
            const circle = (
              <circle
                key={slice.key}
                cx="90"
                cy="90"
                r={radius}
                className="donut-segment"
                style={{
                  stroke: slice.color,
                  strokeDasharray: `${dash} ${circumference - dash}`,
                  strokeDashoffset: -offset
                }}
              />
            );

            offset += dash;
            return circle;
          })}
          <circle cx="90" cy="90" r="48" className="donut-hole" />
        </svg>
        <div className="donut-center">
          <strong>{slices[0]?.percentage ?? 0}%</strong>
          <span>{slices[0]?.label ?? "Mixed"}</span>
        </div>
      </div>

      <div className="donut-legend-stack">
        <ul className="donut-legend" aria-label="Category legend">
          {slices.map((slice) => (
            <li key={slice.key} className="donut-legend-item">
              <span
                className="donut-legend-swatch"
                style={{ backgroundColor: slice.color }}
                aria-hidden="true"
              />
              <span className="donut-legend-label">{slice.label}</span>
              <span className="donut-legend-value">{slice.percentage}%</span>
            </li>
          ))}
        </ul>

        {otherBreakdown.length > 0 ? (
          <div className="donut-other-breakdown" aria-label="Other category breakdown">
            <p className="donut-other-title">Inside Other</p>
            <div className="donut-other-list">
              {otherBreakdown.map((slice) => (
                <span key={slice.key} className="donut-other-pill">
                  {slice.label} {slice.percentage}%
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildChartData(categories: CategoryPercentage[]) {
  const meaningful = categories.filter((entry) => entry.percentage > 0);

  if (meaningful.length <= 4) {
    return {
      slices: meaningful.map((entry) => ({
        key: entry.category,
        label: formatCategoryLabel(entry.category),
        percentage: entry.percentage,
        color: CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other
      })),
      otherBreakdown: [] as ChartSlice[]
    };
  }

  const topCategories = meaningful.slice(0, 3);
  const remainder = meaningful.slice(3);
  const otherPercentage = remainder.reduce((sum, entry) => sum + entry.percentage, 0);
  const slices: ChartSlice[] = topCategories.map((entry) => ({
    key: entry.category,
    label: formatCategoryLabel(entry.category),
    percentage: entry.percentage,
    color: CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other
  }));

  if (otherPercentage > 0) {
    slices.push({
      key: "other-group",
      label: "Other",
      percentage: otherPercentage,
      color: CATEGORY_COLORS.other
    });
  }

  return {
    slices,
    otherBreakdown: remainder.map((entry) => ({
      key: entry.category,
      label: formatCategoryLabel(entry.category),
      percentage: entry.percentage,
      color: CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other
    }))
  };
}
