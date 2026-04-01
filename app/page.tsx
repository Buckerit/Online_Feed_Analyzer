import Link from "next/link";
import { ProjectFooter } from "@/components/ProjectFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessions } from "@/lib/storage";

export default async function HomePage() {
  const sessions = await getSessions();

  return (
    <main className="page-shell">
      <SiteHeader current="home" />

      <section className="hero editorial-hero">
        <div className="panel hero-card">
          <span className="eyebrow">Reflective interface</span>
          <h2 className="hero-title">
            <span>Read a scroll session</span>
            <span>as a digital life</span>
            <span>artifact.</span>
          </h2>
          <p className="hero-copy">
            Turn screenshots and quick notes into a calmer reading of what held the feed together.
          </p>
          <div className="hero-actions">
            <Link href="/create" className="button">
              Start Reflection
            </Link>
            <Link href="/sessions" className="button-secondary">
              All Sessions
            </Link>
          </div>
        </div>

        <aside className="panel sidebar-card project-note-card">
          <div className="section-stack hero-side-stack">
            <div className="hero-side-copy">
              <h3 className="section-title">A feed can be read as a pattern of attention, mood, and habit.</h3>
              <p className="section-copy">
                Instead of treating social media as disposable flow, this project frames one
                session as a small archive of what felt repetitive, ambient, persuasive, or comforting.
              </p>
            </div>
            <p className="footer-note">It is a way to notice how a feed presents itself.</p>
          </div>
        </aside>
      </section>

      <section className="panel section-card">
        <div className="section-heading-row home-section-heading">
          <div className="section-stack home-section-stack">
            <h3 className="section-title">A structured reading flow for digital reflection</h3>
          </div>
        </div>
        <div className="how-grid home-centered-grid">
          <article className="info-card">
            <p className="info-card-number">01</p>
            <h4>Gather a session</h4>
            <p>
              Upload screenshots or write one-line notes that document a single moment of
              scrolling.
            </p>
          </article>
          <article className="info-card">
            <p className="info-card-number">02</p>
            <h4>Generate a reading</h4>
            <p>
              The app groups content into broad categories and writes a reflective reading of the session.
            </p>
          </article>
          <article className="info-card">
            <p className="info-card-number">03</p>
            <h4>Review the archive</h4>
            <p>
              Saved reflections let you compare how attention shifts across sessions.
            </p>
          </article>
        </div>
      </section>

      <section className="panel section-card">
        <div className="section-heading-row home-section-heading">
          <div className="section-stack home-section-stack">
            <h3 className="section-title">What you can read from a feed</h3>
            <p className="section-copy home-section-copy">
              Each reflection turns a scroll into a title, category mix, recurring traits, and a readable summary.
            </p>
          </div>
          <div className="stat-grid home-centered-grid home-stat-grid">
            <div className="stat-card">
              <span>Archived sessions</span>
              <strong>{sessions.length}</strong>
            </div>
            <div className="stat-card">
              <span>Accepted inputs</span>
              <strong>Screenshots or notes</strong>
            </div>
            <div className="stat-card">
              <span>Reading mode</span>
              <strong>Reflective summary</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel section-card" id="start-reflection">
        <div className="header-row section-heading-row home-section-heading">
          <div className="section-stack home-section-stack">
            <h3 className="section-title">Begin a new reflection</h3>
            <p className="section-copy home-section-copy">
              Capture one session and generate a calmer, more legible account of what it contained.
            </p>
          </div>
          <div className="hero-actions landing-cta-actions">
            <Link href="/create" className="button">
              Start Reflection
            </Link>
            <Link href="/sessions" className="button-secondary">
              All Sessions
            </Link>
          </div>
        </div>
      </section>

      <ProjectFooter />
    </main>
  );
}
