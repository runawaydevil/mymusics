import { Link } from "react-router-dom";

type NavKind = "home" | "about";

export function SiteHeader({ nav }: { nav: NavKind }) {
  return (
    <header className="header">
      <Link to="/" className="logo-link" aria-label="MyMusics home">
        <img
          className="logo"
          src="/mymusics.png"
          alt="MyMusics"
          width={200}
          height={80}
          decoding="async"
        />
      </Link>
      <nav className="site-nav" aria-label="Site">
        {nav === "home" ? (
          <Link to="/about" className="nav-link">
            About
          </Link>
        ) : (
          <Link to="/" className="nav-link">
            Back to player
          </Link>
        )}
      </nav>
    </header>
  );
}
