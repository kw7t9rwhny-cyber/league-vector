(() => {
  "use strict";

  const namespace = window.LeagueVectorPremium ||= {};
  const icon = (path) => `<div class="feature-icon" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="${path}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

  namespace.createMarketing = () => {
    const template = document.createElement("template");
    template.innerHTML = `
      <section id="features" class="marketing-section built-to-win" data-reveal>
        <div class="section-heading"><span class="section-kicker">Your complete edge</span><h2>Built to Win</h2><p>Turn a raw league import into clearer decisions without hiding missing data or blending experimental output into established value.</p></div>
        <div class="feature-grid">
          <article class="feature-card" data-spotlight>${icon("M4 18V9m5 9V5m5 13v-7m5 7V3")}<h3>League-aware values</h3><p>Expose the structural pressure created by league size, lineup and scoring beside the market baseline.</p><span class="inline-link">Calculated in your league</span></article>
          <article class="feature-card" data-spotlight>${icon("M12 3l7 3v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6l7-3zm-3 9l2 2 4-5")}<h3>IDP as core context</h3><p>Defensive scoring and roster demand remain first-class league information, with numeric gaps stated plainly.</p><span class="inline-link">Defense is not an add-on</span></article>
          <article class="feature-card" data-spotlight>${icon("M4 8h13m0 0l-3-3m3 3l-3 3M20 16H7m0 0l3-3m-3 3l3 3")}<h3>Trade visibility</h3><p>See team strength, scarcity and roster construction together before judging an opportunity.</p><span class="inline-link">Context before action</span></article>
          <article class="feature-card" data-spotlight>${icon("M5 5h14v14H5zM8 9h8M8 13h5")}<h3>Draft capital</h3><p>Track traded picks beside roster value so today's move is evaluated against tomorrow's flexibility.</p><span class="inline-link">Future assets included</span></article>
          <article class="feature-card" data-spotlight>${icon("M12 4a8 8 0 108 8M12 8v4l3 2")}<h3>Evidence and updates</h3><p>Projection status, scoring coverage and known limitations stay visible instead of disappearing behind one score.</p><span class="inline-link">Know what drives the result</span></article>
        </div>
      </section>

      <section id="league-context" class="marketing-section context-section" data-reveal>
        <div class="constellation-panel" aria-label="Illustration of league relationships"><div class="constellation" aria-hidden="true"><span class="constellation-line line-a"></span><span class="constellation-line line-b"></span><span class="constellation-line line-c"></span><span class="constellation-line line-d"></span><span class="constellation-node you" data-label="Your team">YOU</span><span class="constellation-node one" data-label="Contender"></span><span class="constellation-node two" data-label="Draft rich"></span><span class="constellation-node three" data-label="Trade fit"></span><span class="constellation-node four" data-label="Rebuilder"></span><span class="constellation-node five" data-label="Scarcity"></span></div><div class="constellation-legend" aria-hidden="true"><span><i></i>Your team</span><span><i></i>Potential fit</span><span><i></i>League pressure</span></div></div>
        <article class="context-copy" data-spotlight><span class="section-kicker">The Vector advantage</span><h2>Your league changes the answer.</h2><p>A ranking list sees one player. League Vector is designed to see the player, your scoring, lineup demand, every roster and the draft-capital map surrounding the decision.</p><ul class="context-points"><li><span>01</span>Value stays separate from experimental projected production.</li><li><span>02</span>League structure is shown before recommendations are trusted.</li><li><span>03</span>Unsupported inputs remain visible as limitations.</li></ul></article>
      </section>

      <section id="methodology" class="marketing-section receipt-section" data-reveal>
        <article class="receipt-copy"><span class="section-kicker">Evidence before confidence</span><h2>See the reasoning, not just the answer.</h2><p>Each important number should be inspectable. The goal is not false certainty; it is a clearer view of what is known, experimental and still unavailable.</p></article>
        <article class="receipt-panel" data-spotlight aria-label="Example decision evidence panel"><div class="receipt-header"><span class="receipt-label">Decision evidence</span><span class="receipt-state">Transparent</span></div><h3 class="receipt-title">League-aware assessment</h3><div class="receipt-subtitle">Populated from the imported league and supported sources</div><div class="receipt-rows"><div class="receipt-row"><span>League structure</span><strong>Calculated after import</strong></div><div class="receipt-row"><span>Market baseline</span><strong>Source and match disclosed</strong></div><div class="receipt-row"><span>Projection coverage</span><strong>Complete, partial or unavailable</strong></div><div class="receipt-row"><span>IDP numeric value</span><strong>Fails closed when unsupported</strong></div><div class="receipt-row"><span>Confidence</span><strong>Bounded by evidence</strong></div></div><div class="receipt-meter" aria-hidden="true"><i class="active"></i><i class="active"></i><i class="active"></i><i class="active"></i><i class="active"></i><i class="active"></i><i></i><i></i><i></i><i></i></div><div class="receipt-footnote">Illustrative interface. Actual output depends on the imported league and current source coverage.</div></article>
      </section>

      <section class="marketing-section final-cta" data-reveal data-reveal-delay="1"><div class="final-cta-copy"><span class="section-kicker">Ready to see your league?</span><h2>Turn your league into an edge.</h2><p>Paste the same Sleeper league ID or URL into the importer above. The existing analyzer remains the engine underneath this presentation layer.</p></div><a class="final-cta-link" href="#leagueId">Import from Sleeper <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true"><path d="M1 5.5h13M10 1l4.5 4.5L10 10" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg></a></section>
    `;
    return template.content;
  };

  namespace.createFooter = () => namespace.element(`
    <footer class="site-footer"><div class="footer-inner"><div class="footer-brand"><a class="brand brand-lockup" href="#top"><svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#e7b84f" d="M3 8h10.5L24 25.2 34.5 8H45L24 43z"/><path fill="#050705" d="M13.4 12h6.9l3.7 6.1 3.7-6.1h6.9L24 29.4z"/></svg><span class="brand-copy">LEAGUE VECTOR<small>Dynasty + IDP Intelligence</small></span></a><p>League-aware fantasy intelligence for managers who want transparent data, serious IDP context and better long-term decisions.</p></div><div class="footer-column"><h3>Product</h3><a href="#features">Features</a><a href="#league-context">League context</a><a href="#methodology">Methodology</a></div><div class="footer-column"><h3>Analyze</h3><a href="#leagueId">Import league</a><a href="#results">League results</a><a href="#top">Overview</a></div><div class="footer-column"><h3>Principles</h3><a href="#methodology">Evidence</a><a href="#methodology">Data quality</a><a href="#features">IDP context</a></div></div><div class="footer-bottom"><span>© 2026 League Vector. Foundation v0.8.</span><div class="footer-bottom-links"><a href="#top">Back to top</a><span>League-aware. Evidence-first.</span></div></div></footer>
  `);
})();
