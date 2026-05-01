import { SiteHeader } from "../components/SiteHeader";
import "../App.css";

export default function About() {
  return (
    <div className="page page-about">
      <SiteHeader nav="about" />

      <main className="main main-about">
        <div className="about-shell">
          <article className="card about-card">
            <h1 className="about-title">About MyMusics</h1>

            <div className="about-prose">
              <p>
                MyMusics is a small love letter to a corner of the early web: millions of songs
                lived on MySpace profiles—messy, heartfelt, often buried under glitter and
                autoplay. Many of those tracks survived thanks to archivists and the{" "}
                <strong>Internet Archive</strong>, bundled in collections such as{" "}
                <em>The Myspace Dragon Hoard</em>. This project aggregates metadata for those
                recordings and lets you hit “random” and listen again, streamed from the Archive’s
                mirrors of history rather than from MySpace itself (that ship sailed long ago).
              </p>

              <p>
                Years ago I stumbled on another player or demo built around the same idea. I wish I
                could name the author and link to their work; memory failed me, so proper credit
                goes missing here with my apologies. What you see today is not a fork: the stack,
                server, UX, and plenty of behaviour were reworked from scratch. I changed a lot,
                learned a lot, and I’m genuinely happy with how it turned out.
              </p>

              <p>
                The old internet was slower, louder, and less polished—but it felt owned by people.
                Bands shouted into the void with orange backgrounds; friends traded playlists in
                comments; nothing asked you for a subscription before it would play a song. If
                this player reminds you of that era for even a minute, it did its job.
              </p>
            </div>
          </article>
        </div>
      </main>

      <footer className="footer">
        <small className="muted">Developed by Pablo Murad — 2026</small>
      </footer>
    </div>
  );
}
