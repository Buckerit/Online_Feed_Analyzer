import Link from "next/link";

type SiteHeaderProps = {
  current?: "home" | "sessions" | "create";
};

export function SiteHeader({ current }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-block">
          <span className="course-tag">ENGL 108D · Digital Lives</span>
          <div>
            <p className="brand-title">Scroll Mirror</p>
            <p className="brand-subtitle">
              A reflective tool for reading your feed as a digital life artifact
            </p>
          </div>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <Link
            href="/"
            className={current === "home" ? "nav-link nav-link-active" : "nav-link"}
          >
            Home
          </Link>
          <Link
            href="/sessions"
            className={current === "sessions" ? "nav-link nav-link-active" : "nav-link"}
          >
            Sessions
          </Link>
          <Link
            href="/create"
            className={current === "create" ? "nav-link nav-link-active" : "nav-link"}
          >
            Start Reflection
          </Link>
        </nav>
      </div>
    </header>
  );
}
