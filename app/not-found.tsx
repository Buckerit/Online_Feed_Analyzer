import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="page-shell">
      <section className="panel content-card">
        <span className="eyebrow">Not found</span>
        <h1 className="page-title">That session does not exist</h1>
        <p className="lede">
          The requested record could not be found. Head back home and choose another session.
        </p>
        <div style={{ marginTop: 18 }}>
          <Link href="/" className="button">
            Return Home
          </Link>
        </div>
      </section>
    </main>
  );
}
