(() => {
  "use strict";

  const ACTIVE_CLASS = "command-center-active";
  const setActive = (active) => {
    document.body.classList.toggle(ACTIVE_CLASS, Boolean(active));
  };
  const hasCommandCenterData = (detail) => Boolean(
    detail?.league && Array.isArray(detail.teams) && detail.teams.length,
  );

  window.addEventListener("leaguevector:analysis-start", () => setActive(false));
  window.addEventListener("leaguevector:analysis-ready", (event) => setActive(hasCommandCenterData(event.detail)));
  window.addEventListener("leaguevector:analysis-error", () => setActive(false));

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('#commandCenter [data-command="run-another"]')) setActive(false);
  });

  if (hasCommandCenterData(window.LeagueVectorLastAnalysis)) setActive(true);
})();
