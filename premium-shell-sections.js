(() => {
  "use strict";

  const namespace = window.LeagueVectorPremium ||= {};
  const icon = (path) => `<div class="feature-icon" aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="${path}" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  const sourceIcon = (label) => `<span class="source-monogram" aria-hidden="true">${label}</span>`;
  const featureStatus = (label, tone = "available") => `<span class="feature-status ${tone}">${label}</span>`;

  namespace.createMarketing = () => {
    const template = document.createElement("template");
    template.innerHTML = `
      <section id="features" class="marketing-section built-to-win" data-reveal>
        <div class="section-heading"><span class="section-kicker">Your complete edge</span><h2>Built to Win</h2><p>Everything important in your league, organized around the decisions that actually change a dynasty.</p></div>
        <div class="feature-grid">
          <article class="feature-card" data-spotlight>${icon("M4 18V9m5 9V5m5 13v-7m5 7V3")}<h3>Offensive Valuations</h3><p>Separate market baseline, age, production and league pressure so supported offensive value is easier to understand.</p>${featureStatus("Available now")}</article>
          <article class="feature-card" data-spotlight>${icon("M12 3l7 3v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6l7-3zm-3 9l2 2 4-5")}<h3>IDP Rankings</h3><p>Experimental current-season IDP rankings appear only when approved coverage is available. Numeric IDP dynasty value remains unavailable.</p>${featureStatus("Experimental", "experimental")}</article>
          <article class="feature-card" data-spotlight>${icon("M4 8h13m0 0l-3-3m3 3l-3 3M20 16H7m0 0l3-3m-3 3l3 3")}<h3>Trade Context</h3><p>League structure and roster context are available now. A complete recommendation engine and team-impact model are still being built.</p>${featureStatus("In development", "planned")}</article>
          <article class="feature-card" data-spotlight>${icon("M5 5h14v14H5zM8 9h8M8 13h5")}<h3>Draft Capital</h3><p>Track current and traded picks beside roster value so future flexibility stays visible.</p>${featureStatus("Available now")}</article>
          <article class="feature-card" data-spotlight>${icon("M4 12a8 8 0 1016 0A8 8 0 004 12zm4 0h8M12 4c2 2 3 4.7 3 8s-1 6-3 8c-2-2-3-4.7-3-8s1-6 3-8")}<h3>League Context</h3><p>Supported offensive players are viewed inside your actual lineup, scoring, roster demand and league structure.</p>${featureStatus("Available now")}</article>
          <article class="feature-card" data-spotlight>${icon("M4 5h16v14H4zM8 9h8M8 13h5M8 16h3")}<h3>Transparent Methodology</h3><p>See data coverage, confidence, known limits and the factors that drive each supported result.</p>${featureStatus("Available now")}</article>
        </div>
      </section>

      <section class="data-foundation" data-reveal data-reveal-delay="1" aria-label="League Vector data foundation">
        <div class="foundation-heading"><span class="section-kicker">Trusted data. Clear boundaries.</span><h2>Built on football information you can inspect.</h2></div>
        <div class="foundation-grid">
          <article>${sourceIcon("S")}<div><strong>Sleeper League Import</strong><span>Settings, rosters, transactions and traded picks</span></div></article>
          <article>${sourceIcon("MV")}<div><strong>Market Baselines</strong><span>Public and defensible dynasty market inputs</span></div></article>
          <article>${sourceIcon("HP")}<div><strong>Historical Production</strong><span>Performance data used for transparent research</span></div></article>
          <article>${sourceIcon("QA")}<div><strong>Coverage Disclosure</strong><span>Complete, partial and unavailable states stay visible</span></div></article>
        </div>
      </section>

      <section id="data-status" class="marketing-section data-status-section" data-reveal aria-labelledby="data-status-title">
        <div class="section-heading compact"><span class="section-kicker">Foundation beta v0.8</span><h2 id="data-status-title">Know what the product supports today.</h2><p>Status labels describe the current tested product—not a future promise and not a substitute for the evidence shown after import.</p></div>
        <div class="product-status-grid">
          <article class="product-status-card available" data-spotlight><div class="product-status-heading"><span>Available now</span><strong>Supported product paths</strong></div><ul><li>Sleeper league settings, rosters and owners</li><li>Lineup and scoring-context analysis</li><li>Supported offensive market values</li><li>Draft-pick inventory and offensive team totals</li><li>Coverage, warning and confidence disclosures</li></ul></article>
          <article class="product-status-card experimental" data-spotlight><div class="product-status-heading"><span>Experimental</span><strong>Visible with explicit boundaries</strong></div><ul><li>Future-production projections</li><li>Current-season IDP rankings when an approved contract is available</li><li>Projection scoring-coverage diagnostics</li><li>Partial and unavailable states remain visible</li></ul></article>
          <article class="product-status-card planned" data-spotlight><div class="product-status-heading"><span>In development</span><strong>Not represented as complete</strong></div><ul><li>Numeric IDP dynasty values</li><li>Complete trade recommendation engine</li><li>Team-specific championship probabilities</li><li>Manager acquisition-price and marketability modeling</li></ul></article>
        </div>
        <p class="product-status-note">League Vector fails closed when required evidence is unavailable. Import results can still be partial when a source or identity match is incomplete.</p>
      </section>

      <section class="marketing-section trust-section" data-reveal>
        <div class="section-heading compact"><span class="section-kicker">Why managers trust League Vector</span><h2>Serious tools. No black-box theater.</h2></div>
        <div class="trust-grid">
          <article class="trust-card" data-spotlight>${icon("M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8l3 3M19 5l-3 3M8 16l-3 3")}<div><h3>Transparent Methodology</h3><p>Understand what moved a value, which inputs were available and where uncertainty remains.</p><a class="trust-link" href="#methodology">See the methodology →</a></div></article>
          <article class="trust-card" data-spotlight>${icon("M9 18h6M10 22h4M8 14c-1.8-1.3-3-3.4-3-5.8A7 7 0 0112 1a7 7 0 017 7.2c0 2.4-1.2 4.5-3 5.8-.7.5-1 1.1-1 2H9c0-.9-.3-1.5-1-2z")}<div><h3>Evidence-Based Outputs</h3><p>Supported outputs are grounded in data, tested where possible and separated from unsupported claims.</p><a class="trust-link" href="#data-status">Review current coverage →</a></div></article>
          <article class="trust-card" data-spotlight>${icon("M20 11a8 8 0 10-2.3 5.7M20 5v6h-6")}<div><h3>Versioned Updates</h3><p>Inputs and research artifacts can improve over time without silently changing what a prior result meant.</p><a class="trust-link" href="#data-status">Know what is supported →</a></div></article>
        </div>
      </section>

      <section id="league-context" class="marketing-section valuation-showcase" data-reveal aria-label="Sample League Vector offensive valuation interface">
        <div class="valuation-topline"><div><span class="section-kicker">Sample offensive valuation</span><small>Static interface example · Real supported values populate after import</small></div><span class="valuation-status sample"><i></i>Sample only</span></div>
        <div class="valuation-grid">
          <article class="valuation-player">
            <div class="valuation-avatar"><svg viewBox="0 0 120 140" aria-hidden="true"><defs><linearGradient id="avatarGold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f6d67e"/><stop offset="1" stop-color="#9d6518"/></linearGradient></defs><circle cx="60" cy="39" r="25" fill="url(#avatarGold)" opacity=".88"/><path d="M18 135c4-40 22-65 42-65s38 25 42 65" fill="url(#avatarGold)" opacity=".68"/><path d="M35 76l25 19 25-19 14 18-14 41H35L21 94z" fill="#0b0e0c" stroke="#d9a83e" stroke-opacity=".5"/><path d="M51 95h18v30H51z" fill="#d6a43a" opacity=".85"/></svg></div>
            <div class="valuation-player-copy"><span>Illustrative offensive asset</span><h2>Sample WR1</h2><p>WR · Sample roster</p><div class="valuation-numbers"><div><small>Sample LV Value</small><strong>8,640</strong><em>Illustrative</em></div><div><small>Age</small><strong>24</strong></div><div><small>Pos Rank</small><strong>3</strong></div><div><small>Source</small><strong>Sample</strong></div></div></div>
          </article>
          <article class="valuation-chart">
            <div class="chart-heading"><span>Sample value trend</span><small>Illustrative only · Not live market data</small></div>
            <div class="chart-shell"><div class="chart-y"><span>9K</span><span>8K</span><span>7K</span><span>6K</span><span>5K</span></div><svg viewBox="0 0 580 210" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e9b548" stop-opacity=".34"/><stop offset="1" stop-color="#e9b548" stop-opacity="0"/></linearGradient></defs><path class="chart-area" d="M0 178 L25 166 L48 171 L74 149 L98 155 L124 132 L151 138 L177 119 L202 125 L229 104 L254 112 L280 96 L306 102 L332 84 L358 93 L384 74 L411 80 L438 58 L464 66 L491 43 L518 49 L545 27 L580 8 L580 210 L0 210 Z" fill="url(#chartFill)"/><path class="chart-line" d="M0 178 L25 166 L48 171 L74 149 L98 155 L124 132 L151 138 L177 119 L202 125 L229 104 L254 112 L280 96 L306 102 L332 84 L358 93 L384 74 L411 80 L438 58 L464 66 L491 43 L518 49 L545 27 L580 8" fill="none" stroke="#efbf55" stroke-width="3" vector-effect="non-scaling-stroke"/><circle cx="580" cy="8" r="5" fill="#ffe59a"/></svg><div class="chart-x"><span>SEP</span><span>NOV</span><span>JAN</span><span>MAR</span><span>MAY</span><span>AUG</span></div></div>
          </article>
          <article class="valuation-context">
            <span class="section-kicker">League Context</span><h3>Why an offensive value can change here.</h3><ul><li><i>01</i><div><strong>Starter demand</strong><span>Lineup requirements affect scarcity</span></div></li><li><i>02</i><div><strong>Scoring format</strong><span>League settings change production value</span></div></li><li><i>03</i><div><strong>League depth</strong><span>Team count and roster depth matter</span></div></li><li><i>04</i><div><strong>Age + production</strong><span>Supported inputs remain separated</span></div></li></ul><a href="#leagueId">Import your league →</a>
          </article>
        </div>
      </section>

      <section id="methodology" class="marketing-section evidence-section" data-reveal>
        <article class="evidence-copy"><span class="section-kicker">Evidence before confidence</span><h2>See the reasoning, not just the answer.</h2><p>League Vector is designed to show what is supported, what is experimental and what remains unavailable—before a number is allowed to look certain.</p><div class="evidence-tags"><span>League structure</span><span>Market baseline</span><span>Projection coverage</span><span>Confidence bounds</span></div></article>
        <article class="receipt-panel" data-spotlight aria-label="Example decision evidence panel"><div class="receipt-header"><span class="receipt-label">Decision evidence</span><span class="receipt-state"><i></i>Transparent</span></div><h3 class="receipt-title">League-aware assessment</h3><div class="receipt-subtitle">Populated from the imported league and supported sources</div><div class="receipt-rows"><div class="receipt-row"><span>League structure</span><strong>Calculated after import</strong></div><div class="receipt-row"><span>Market baseline</span><strong>Source and match disclosed</strong></div><div class="receipt-row"><span>Projection coverage</span><strong>Complete, partial or unavailable</strong></div><div class="receipt-row"><span>IDP numeric value</span><strong>Fails closed when unsupported</strong></div><div class="receipt-row"><span>Confidence</span><strong>Bounded by evidence</strong></div></div><div class="receipt-meter" aria-hidden="true"><i class="active"></i><i class="active"></i><i class="active"></i><i class="active"></i><i class="active"></i><i class="active"></i><i></i><i></i><i></i><i></i></div><div class="receipt-footnote">Illustrative interface. Actual output depends on the imported league and current source coverage.</div></article>
      </section>

      <section class="marketing-section final-cta" data-reveal data-reveal-delay="1"><div class="final-cta-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path fill="currentColor" d="M3 8h10.5L24 25.2 34.5 8H45L24 43z"/><path fill="#100b03" d="M13.4 12h6.9l3.7 6.1 3.7-6.1h6.9L24 29.4z"/></svg></div><div class="final-cta-copy"><span class="section-kicker">Foundation beta v0.8</span><h2>Every League Has an Edge.<br>Find Yours.</h2><p>Import a Sleeper league ID or URL. The tested analyzer shows supported results, experimental outputs and unavailable states separately.</p></div><a class="final-cta-link" href="#leagueId">Import from Sleeper <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true"><path d="M1 5.5h13M10 1l4.5 4.5L10 10" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg></a></section>
    `;
    return template.content;
  };

  namespace.createFooter = () => namespace.element(`
    <footer class="site-footer"><div class="footer-inner"><div class="footer-brand"><a class="brand brand-lockup" href="#top"><svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#e7b84f" d="M3 8h10.5L24 25.2 34.5 8H45L24 43z"/><path fill="#050705" d="M13.4 12h6.9l3.7 6.1 3.7-6.1h6.9L24 29.4z"/></svg><span class="brand-copy">LEAGUE VECTOR<small>Dynasty + IDP Intelligence</small></span></a><p>League-aware fantasy intelligence with explicit support boundaries, serious IDP context and transparent evidence.</p></div><div class="footer-column"><h3>Product</h3><a href="#features">Features</a><a href="#preview">Sample interface</a><a href="#data-status">Data status</a></div><div class="footer-column"><h3>Analyze</h3><a href="#leagueId">Import league</a><a href="#results">League results</a><a href="#methodology">Methodology</a></div><div class="footer-column"><h3>Principles</h3><a href="#methodology">Evidence</a><a href="#data-status">Coverage disclosure</a><a href="#data-status">IDP boundaries</a></div></div><div class="footer-bottom"><span>© 2026 League Vector · Foundation beta v0.8 · Independent project not affiliated with or endorsed by Sleeper or the NFL.</span><div class="footer-bottom-links"><a href="#top">Back to top</a><span>Every League Has an Edge. Find Yours.</span></div></div></footer>
  `);
})();
