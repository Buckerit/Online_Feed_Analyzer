import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";
import { ProjectFooter } from "@/components/ProjectFooter";
import { SessionReport } from "@/components/SessionReport";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionById } from "@/lib/storage";

export default async function SessionResultsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionById(id);

  if (!session) {
    notFound();
  }

  return (
    <main className="page-shell">
      <SiteHeader />

      <section className="panel result-hero">
        <div className="header-row result-hero-row">
          <div>
            <span className="eyebrow">Session reflection</span>
            <h1 className="page-title">{session.analysis.session_title}</h1>
            <p className="lede">
              {new Date(session.updatedAt).toLocaleString()} · {session.items.length} items
            </p>
          </div>
          <div className="action-row">
            <Link href="/" className="link-button">
              Home
            </Link>
            <Link href="/sessions" className="link-button">
              All Sessions
            </Link>
            <Link href="/create" className="button-secondary">
              Start Reflection
            </Link>
            <DeleteSessionButton sessionId={session.id} label="Delete" />
          </div>
        </div>
      </section>

      <SessionReport session={session} />
      <ProjectFooter />
    </main>
  );
}
