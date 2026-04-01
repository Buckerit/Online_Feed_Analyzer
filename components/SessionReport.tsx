import { CategoryDonutChart } from "@/components/CategoryDonutChart";
import { DominantSideReveal } from "@/components/DominantSideReveal";
import { formatCategoryLabel, formatItemHeading } from "@/lib/format";
import type { ScrollSession } from "@/lib/types";

export function SessionReport({
  session
}: {
  session: ScrollSession;
}) {
  const { analysis } = session;

  return (
    <div className="report-layout">
      <DominantSideReveal
        dominantSide={analysis.dominant_side}
        dominantSideDescription={analysis.dominant_side_description}
      />
      <section className="panel summary-hero">
        <span className="eyebrow">Reflective summary</span>
        <div className="summary-copy">
          <p>{analysis.summary.join(" ")}</p>
        </div>
      </section>

      <section className="report-grid">
        <article className="panel report-card">
          <div className="section-header">
            <h3>Where attention gathered</h3>
            <p className="section-copy">A readable split of the themes that surfaced most often.</p>
          </div>
          <CategoryDonutChart categories={analysis.dominant_categories} />
        </article>

        <article className="panel report-card">
          <div className="section-header">
            <h3>Patterns and textures</h3>
            <p className="section-copy">Recurring tones, habits, and stylistic cues across the session.</p>
          </div>
          {analysis.dominant_side ? (
            <div className="dominant-side-block">
              <span className="section-kicker">Dominant side</span>
              <h4 className="dominant-side-title">{analysis.dominant_side}</h4>
              {analysis.dominant_side_description ? (
                <p className="dominant-side-copy">{analysis.dominant_side_description}</p>
              ) : null}
            </div>
          ) : null}
          <div className="trait-row">
            {analysis.style_traits.map((trait) => (
              <span className="trait-pill" key={trait}>
                {trait}
              </span>
            ))}
          </div>
          <div className="pattern-list">
            {analysis.notable_patterns.map((pattern) => (
              <p key={pattern}>{pattern}</p>
            ))}
          </div>
        </article>
      </section>

      <details className="panel item-drawer">
        <summary>Read the individual items</summary>
        <div className="item-breakdown-list">
          {session.items.map((item, index) => (
            <article className="item-row" key={item.id}>
              <div className="item-row-media">
                {item.type === "image" ? (
                  <div className="item-frame compact-frame">
                    <img src={item.content} alt={item.label} />
                  </div>
                ) : (
                  <div className="text-block compact-text">{item.content}</div>
                )}
              </div>
              <div className="item-row-copy">
                <div className="item-row-head">
                  <h4>
                    {formatItemHeading({
                      type: item.type,
                      note: item.note,
                      description: item.assistantAnalysis.description,
                      index
                    })}
                  </h4>
                  <span className="mini-chip">{formatCategoryLabel(item.category)}</span>
                </div>
                {item.type === "image" ? <p className="item-meta">{item.label}</p> : null}
                {item.note ? <p className="item-note">Note: {item.note}</p> : null}
                <p>{item.assistantAnalysis.description}</p>
                <div className="chip-row">
                  {item.assistantAnalysis.styleTraits.map((trait) => (
                    <span className="chip" key={`${item.id}-${trait}`}>
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
