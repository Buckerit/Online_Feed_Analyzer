import Link from "next/link";
import { ProjectFooter } from "@/components/ProjectFooter";
import { SessionCard } from "@/components/SessionCard";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessions } from "@/lib/storage";

export default async function SessionsPage() {
  const sessions = await getSessions();

  return (
    <main className="page-shell">
      <SiteHeader current="sessions" />

      <section className="page-intro">
        <span className="eyebrow">Sessions</span>
        <h2 className="page-title">Reflection archive</h2>
        <p className="lede">
          Revisit past sessions to compare what surfaced, repeated, or shifted over time.
        </p>
      </section>

      <section className="archive-page-actions">
        <div className="hero-actions">
          <Link href="/create" className="button">
            Start Reflection
          </Link>
        </div>
      </section>

      {sessions.length === 0 ? (
        <div className="empty-state archive-empty-state">
          No sessions yet. Start a reflection to begin building your archive.
        </div>
      ) : (
        <div className="session-grid archive-session-grid archive-session-grid-minimal">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}

      <ProjectFooter />
    </main>
  );
}
