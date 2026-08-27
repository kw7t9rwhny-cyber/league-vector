(() => {
  "use strict";

  function buildPremiumShell() {
    const premium = window.LeagueVectorPremium;
    const main = document.querySelector("main.wrap");
    const originalBrand = main?.querySelector(".brand");
    const hero = main?.querySelector(".hero");
    const eyebrow = hero?.querySelector(".eyebrow");
    const title = hero?.querySelector("h1");
    const subtitle = hero?.querySelector(".sub");
    const form = hero?.querySelector(".form");
    const importButton = form?.querySelector("button");
    const status = hero?.querySelector('[role="status"]');
    const results = hero?.nextElementSibling;

    if (!premium?.element || !premium.createHeader || !premium.createHeroVisual || !premium.createPreview || !premium.createMarketing || !premium.createFooter) return false;
    if (!main || !originalBrand || !hero || !eyebrow || !title || !subtitle || !form || !importButton || !status || results?.id !== "results") return false;

    const header = premium.createHeader();
    const heroVisual = premium.createHeroVisual();
    const preview = premium.createPreview();
    const marketing = premium.createMarketing();
    const footer = premium.createFooter();
    const skipLink = premium.element('<a class="skip-link" href="#leagueId">Skip to league import</a>');
    const proof = premium.element('<div class="hero-proof" aria-label="League Vector product strengths"><span><i>↗</i>League-aware values</span><span><i>◆</i>IDP built in</span><span><i>✓</i>Evidence disclosed</span></div>');
    const secondary = premium.element('<div class="hero-secondary-row"><a class="secondary-cta" href="#features"><span class="play-dot" aria-hidden="true">▶</span>See how it works</a></div>');
    const trust = premium.element('<div class="hero-trust"><div class="manager-stack" aria-hidden="true"><i>LV</i><i>IDP</i><i>SF</i><i>+</i></div><div><strong>Built for serious dynasty managers</strong><span>League-specific context for offense, defense and draft capital.</span></div></div>');
    if (!header || !heroVisual || !preview || !marketing || !footer || !skipLink || !proof || !secondary || !trust) return false;

    document.body.id = "top";
    originalBrand.remove();
    document.body.insertBefore(skipLink, main);
    document.body.insertBefore(header, main);

    eyebrow.textContent = "Dynasty + IDP Fantasy Football";
    title.classList.add("hero-slogan");
    title.innerHTML = '<span class="hero-line hero-line-primary">Every League</span><br><span class="hero-line hero-line-secondary">Has an Edge.</span><br><span class="hero-line accent-line">Find Yours.</span>';
    subtitle.textContent = "League Vector reveals the structural, positional and market edge hidden inside your Sleeper league—then gives you the evidence to use it.";
    subtitle.classList.add("hero-sub");
    form.classList.add("hero-form");
    importButton.classList.add("hero-import-button");
    importButton.setAttribute("aria-label", "Analyze League");
    importButton.innerHTML = '<span class="sleeper-glyph" aria-hidden="true">S</span><span>Import from Sleeper</span>';
    status.classList.add("hero-status");

    form.before(proof);
    secondary.append(status);
    form.after(secondary);
    secondary.after(trust);
    const heroCopy = document.createElement("div");
    heroCopy.className = "hero-copy";
    for (const child of [...hero.children]) heroCopy.append(child);
    hero.classList.add("premium-hero");
    hero.dataset.reveal = "";
    hero.append(heroCopy, heroVisual);
    hero.after(preview);
    results.after(marketing);
    document.body.append(footer);
    document.body.classList.add("premium-homepage");
    return true;
  }

  try {
    buildPremiumShell();
  } catch (error) {
    console.warn("League Vector premium shell was skipped.", error);
  }
})();
