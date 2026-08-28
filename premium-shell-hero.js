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
        <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="brandGold" x1="3" y1="2" x2="44" y2="47"><stop stop-color="#ffe4a4"/><stop offset=".5" stop-color="#e6b349"/><stop offset="1" stop-color="#8c5812"/></linearGradient></defs><path fill="url(#brandGold)" d="M3 8h10.5L24 25.2 34.5 8H45L24 43z"/><path fill="#050604" d="M13.4 12h6.9l3.7 6.1 3.7-6.1h6.9L24 29.4z"/></svg>
        <span class="brand-copy">LEAGUE VECTOR<small>Dynasty + IDP Intelligence</small></span>
      </a>
      <nav class="primary-nav" aria-label="Primary navigation"><a href="#top" aria-current="page">Home</a><a href="#features">Features</a><a href="#preview">Product</a><a href="#data-status">Data Status</a><a href="#methodology">Methodology</a></nav>
      <div class="header-actions"><a class="header-login" href="#data-status">Current Status</a><a class="header-cta" href="#leagueId">Get Started</a></div>
    </header>
  `);

  namespace.createHeroVisual = () => element(`
    <div class="hero-visual" aria-hidden="true">
      <div class="hero-athlete"></div>
      <div class="hero-athlete-glow"></div>
      <canvas id="vectorField"></canvas>
      <div class="hero-speed-lines"></div>
      <div class="hero-metric metric-value"><span>Offensive value</span><strong class="metric-word">Sample</strong><em>Populates after import</em></div>
      <div class="hero-metric metric-power"><span>League context</span><strong class="metric-word">Mapped</strong><em>Scoring + rosters</em></div>
      <div class="hero-metric metric-edge"><span>Trade context</span><strong class="metric-word">Roadmap</strong><em>In development</em></div>
    </div>
  `);

  const sparkline = (points, tone = "gold") => `<svg class="sparkline ${tone}" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true"><path class="sparkline-fill" d="M0 34 L${points} L120 34 Z"/><polyline points="${points}" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
  namespace.createPreview = () => element(`
    <section id="preview" class="preview-dashboard" aria-label="Sample League Vector product interface" data-reveal data-reveal-delay="1">
      <div class="preview-heading"><div><span>Sample league interface</span><strong>One import. A clearer competitive picture.</strong></div><small>Static sample data · Real results populate only after a successful league import</small></div>
      <div class="preview-grid">
        <article class="preview-card power-card" data-spotlight>
          <div class="preview-card-header"><div><span>League Power Rankings</span><small>Sample 12-team Dynasty · SF · IDP</small></div><b>SAMPLE</b></div>
          <div class="ranking-list"><div class="ranking-row leader"><i>1</i><span>Sample Contender</span><strong>96.3</strong></div><div class="ranking-row"><i>2</i><span>Sample Rebuilder</span><strong>92.1</strong></div><div class="ranking-row"><i>3</i><span>Sample Youth Core</span><strong>88.7</strong></div><div class="ranking-row"><i>4</i><span>Sample Veteran Core</span><strong>84.2</strong></div></div>
          <div class="preview-card-note">Sample view · Live league results after import</div>
        </article>

        <article class="preview-card asset-card" data-spotlight>
          <div class="preview-card-header"><div><span>Offensive Player Value</span><small>Sample league-adjusted dynasty value</small></div><b>SAMPLE</b></div>
          <div class="asset-profile"><div class="asset-avatar"><span>WR</span></div><div><strong>Sample WR1</strong><small>WR · Sample roster</small></div></div>
          <div class="asset-value-row"><div><span>Sample LV Value</span><strong>8,640</strong></div><em>Illustrative</em></div>
          ${sparkline("0,29 12,27 24,30 36,22 48,24 60,18 72,20 84,12 96,15 108,7 120,3")}
          <div class="preview-card-note">Offensive values use supported market inputs</div>
        </article>

        <article class="preview-card rookie-card" data-spotlight>
          <div class="preview-card-header"><div><span>Rookie Class</span><small>Sample class hierarchy</small></div><b>SAMPLE</b></div>
          <div class="rookie-list"><div><i>1</i><span><strong>Rookie RB1</strong><small>RB</small></span><b>9,215</b></div><div><i>2</i><span><strong>Rookie WR1</strong><small>WR</small></span><b>7,842</b></div><div><i>3</i><span><strong>Rookie WR2</strong><small>WR</small></span><b>7,123</b></div><div><i>4</i><span><strong>Rookie QB1</strong><small>QB</small></span><b>5,912</b></div></div>
          <div class="preview-card-note">Sample hierarchy · Not a published rookie board</div>
        </article>

        <article class="preview-card movement-card" data-spotlight>
          <div class="preview-card-header"><div><span>Market Movement</span><small>Sample seven-day interface</small></div><b>SAMPLE</b></div>
          <div class="movement-list"><div><span><strong>Sample WR A</strong><small>WR</small></span>${sparkline("0,27 24,26 48,20 72,22 96,12 120,8", "green")}<b class="up">+6.4%</b></div><div><span><strong>Sample RB A</strong><small>RB</small></span>${sparkline("0,28 24,25 48,27 72,18 96,14 120,9", "green")}<b class="up">+4.2%</b></div><div><span><strong>Sample QB A</strong><small>QB</small></span>${sparkline("0,15 24,18 48,13 72,21 96,24 120,28", "red")}<b class="down">−2.8%</b></div><div><span><strong>Sample TE A</strong><small>TE</small></span>${sparkline("0,11 24,15 48,14 72,22 96,25 120,30", "red")}<b class="down">−5.1%</b></div></div>
          <div class="preview-card-note">Sample movement · Not live market data</div>
        </article>
      </div>
    </section>
  `);
})();
