const pillars = [
  {
    eyebrow: 'Discover',
    title: 'Find useful projects beyond the obvious.',
    body: 'Search will eventually combine repository metadata, transparent signals, and intent instead of sorting everything by lifetime stars.',
  },
  {
    eyebrow: 'Understand',
    title: 'See why a repository is worth your attention.',
    body: 'RepoScout will surface activity, maintenance, release, contribution, and community signals without pretending they form one universal quality score.',
  },
  {
    eyebrow: 'Contribute',
    title: 'Help overlooked open source get discovered.',
    body: 'A beginner-friendly submission flow will let anyone suggest a missing repository while moderation keeps the index trustworthy.',
  },
] as const;

export function App() {
  return (
    <main className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />

      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label="RepoScout home">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-mark-dot" />
          </span>
          <span>RepoScout</span>
        </a>

        <span className="phase-badge">Foundation · Phase 1A</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">Open-source discovery, without the popularity bias</p>
        <h1 id="hero-title">Discover open source worth knowing.</h1>
        <p className="hero-copy">
          RepoScout is building a community-curated repository intelligence layer
          for finding useful projects, hidden gems, and realistic contribution
          opportunities.
        </p>

        <div className="search-preview" aria-label="Future RepoScout search preview">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <span>Find a self-hosted analytics tool that is actively maintained…</span>
          <span className="search-status">Search coming in a later phase</span>
        </div>
      </section>

      <section className="pillar-grid" aria-label="RepoScout product pillars">
        {pillars.map((pillar) => (
          <article className="pillar-card" key={pillar.eyebrow}>
            <span>{pillar.eyebrow}</span>
            <h2>{pillar.title}</h2>
            <p>{pillar.body}</p>
          </article>
        ))}
      </section>

      <footer className="foundation-note">
        <span className="signal-dot" aria-hidden="true" />
        Project skeleton ready for repository ingestion work.
      </footer>
    </main>
  );
}
