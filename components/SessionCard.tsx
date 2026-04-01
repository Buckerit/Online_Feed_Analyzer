import Link from "next/link";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";
import { formatCategoryLabel } from "@/lib/format";
import type { ScrollSession } from "@/lib/types";

export function SessionCard({ session }: { session: ScrollSession }) {
  const topCategories = session.analysis.dominant_categories.slice(0, 2);
  const topTraits = session.analysis.style_traits.slice(0, 3);

  return (
    <article className="session-card">
      <div className="session-card-top">
        <div>
          <p className="session-card-label">Archived reflection</p>
          <h3 className="session-card-title">{session.analysis.session_title}</h3>
        </div>
        <p className="session-meta">{new Date(session.createdAt).toLocaleString()}</p>
      </div>

      <div className="session-facts">
        <span>{session.items.length} items</span>
      </div>

      <p className="session-insight session-insight-clamped">{session.analysis.summary[0]}</p>

      <div className="chip-row">
        {topCategories.map((entry) => (
          <span className="chip" key={entry.category}>
            {formatCategoryLabel(entry.category)} {entry.percentage}%
          </span>
        ))}
      </div>

      <div className="chip-row">
        {topTraits.map((trait) => (
          <span className="badge" key={trait}>
            {trait}
          </span>
        ))}
      </div>

      <div className="card-actions session-card-actions">
        <Link href={`/sessions/${session.id}`} className="button-secondary">
          View
        </Link>
        <DeleteSessionButton
          sessionId={session.id}
          label="Delete"
          className="button-tertiary button-tertiary-danger"
        />
      </div>
    </article>
  );
}
