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
    const promise = premium.element('<ul class="hero-promise" aria-label="League Vector product strengths"><li>League-aware context</li><li>IDP included</li><li>Evidence disclosed</li></ul>');
    const secondary = premium.element('<div class="hero-secondary-row"><a class="secondary-cta" href="#features">See how it works <svg width="15" height="10" viewBox="0 0 15 10" aria-hidden="true"><path d="M1 5h12M9 1l4 4-4 4" fill="none" stroke="currentColor" stroke-linecap="round"/></svg></a></div>');
    if (!header || !heroVisual || !preview || !marketing || !footer || !skipLink || !promise || !secondary) return false;

    document.body.id = "top";
    originalBrand.remove();
    document.body.insertBefore(skipLink, main);
    document.body.insertBefore(header, main);

    eyebrow.textContent = "Dynasty + IDP Fantasy Football • Foundation v0.8";
    title.innerHTML = '<span class="hero-line">Win today.</span><br><span class="hero-line accent-line">Build forever.</span>';
    subtitle.textContent = "League Vector turns your Sleeper league into league-aware fantasy intelligence. See structure, values, draft capital, experimental projections and data-quality limits in one place.";
    subtitle.classList.add("hero-sub");
    form.classList.add("hero-form");
    importButton.classList.add("hero-import-button");
    importButton.setAttribute("aria-label", "Analyze League");
    importButton.innerHTML = '<span class="sleeper-glyph" aria-hidden="true">S</span><span>Import from Sleeper</span>';
    status.classList.add("hero-status");

    form.before(promise);
    secondary.append(status);
    form.after(secondary);
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
