(() => {
  "use strict";

  const namespace = window.LeagueVectorPremium ||= {};
  const element = (markup) => {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  };

  namespace.element = element;
  namespace.createHeader = () => element(`
    <header class="site-header">
      <a class="brand brand-lockup" href="#top" aria-label="League Vector home">
        <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="brandGold" x1="4" y1="2" x2="42" y2="46"><stop stop-color="#ffe09a"/><stop offset=".48" stop-color="#e8b84d"/><stop offset="1" stop-color="#9b6517"/></linearGradient></defs><path fill="url(#brandGold)" d="M3 8h10.5L24 25.2 34.5 8H45L24 43z"/><path fill="#050705" d="M13.4 12h6.9l3.7 6.1 3.7-6.1h6.9L24 29.4z"/></svg>
        <span class="brand-copy">LEAGUE VECTOR<small>Dynasty + IDP Intelligence</small></span>
      </a>
      <nav class="primary-nav" aria-label="Primary navigation"><a href="#top" aria-current="page">Home</a><a href="#features">Features</a><a href="#league-context">League Context</a><a href="#methodology">Methodology</a></nav>
      <div class="header-actions"><a class="header-cta" href="#leagueId">Import League</a></div>
    </header>
  `);

  namespace.createHeroVisual = () => element(`
    <div class="hero-visual" aria-hidden="true">
      <canvas id="vectorField"></canvas>
      <div class="vector-core">
        <div class="core-orbit orbit-one"></div><div class="core-orbit orbit-two"></div><div class="core-orbit orbit-three"></div><div class="core-halo"></div><div class="core-scan"></div>
        <div class="core-mark"><svg viewBox="0 0 240 240"><defs><linearGradient id="coreGold" x1="40" y1="20" x2="190" y2="220"><stop stop-color="#fff0b6"/><stop offset=".38" stop-color="#e8b84e"/><stop offset="1" stop-color="#80500f"/></linearGradient><linearGradient id="coreDark" x1="70" y1="30" x2="170" y2="210"><stop stop-color="#20241f"/><stop offset="1" stop-color="#050705"/></linearGradient></defs><path fill="url(#coreGold)" d="M23 37h52l45 73 45-73h52l-97 169z"/><path fill="url(#coreDark)" stroke="rgba(255,226,151,.42)" stroke-width="2" d="M71 51h30l19 31 19-31h30l-49 87z"/><path fill="none" stroke="rgba(255,221,139,.24)" stroke-width="2" d="M45 50l75 130 75-130"/></svg></div>
      </div>
      <div class="floating-signal signal-context"><span>League context</span><strong>Scoring aware</strong><em>Calculated after import</em></div>
      <div class="floating-signal signal-idp"><span>IDP coverage</span><strong>Core context</strong><em>Limits disclosed</em></div>
      <div class="floating-signal signal-draft"><span>Draft capital</span><strong>Future value</strong><em>Pick ownership tracked</em></div>
      <div class="hero-corner-label">One league. Every angle.</div>
    </div>
  `);

  const bars = (values) => values.map((height, index) => `<i style="--bar-height:${height}%;--bar-delay:${40 + index * 40}ms"></i>`).join("");
  namespace.createPreview = () => element(`
    <section class="preview-rail" aria-label="League Vector analysis preview" data-reveal data-reveal-delay="1">
      <article class="preview-card" data-spotlight><div class="preview-card-top"><span class="preview-card-label">League power</span><span class="preview-card-index">01</span></div><div class="preview-card-value">League-wide view</div><div class="preview-card-note">Compare team structure with supported data after import.</div><div class="mini-chart" aria-hidden="true">${bars([32,42,38,58,51,72,66,88])}</div></article>
      <article class="preview-card" data-spotlight><div class="preview-card-top"><span class="preview-card-label">Team window</span><span class="preview-card-index">02</span></div><div class="preview-card-value">Roster trajectory</div><div class="preview-card-note">See present strength beside age, picks and future flexibility.</div><div class="mini-chart" aria-hidden="true">${bars([42,54,69,82,90,78,61,48])}</div></article>
      <article class="preview-card" data-spotlight><div class="preview-card-top"><span class="preview-card-label">Asset context</span><span class="preview-card-index">03</span></div><div class="preview-card-value">League-specific value</div><div class="preview-card-note">Separate market baselines from pressure created by your format.</div><div class="mini-chart" aria-hidden="true">${bars([36,46,43,62,71,64,81,94])}</div></article>
      <article class="preview-card" data-spotlight><div class="preview-card-top"><span class="preview-card-label">Data confidence</span><span class="preview-card-index">04</span></div><div class="preview-card-value">Coverage disclosed</div><div class="preview-card-note">Unsupported values stay unavailable instead of being invented.</div><div class="mini-chart" aria-hidden="true">${bars([72,77,75,82,79,87,91,94])}</div></article>
    </section>
  `);
})();
