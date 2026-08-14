"use strict";

importScripts(
  "idp-foundation-research-v03.js?v=0.3",
  "idp-current-season-rankings-v01.js?v=0.1",
);

self.onmessage = (event) => {
  const { request_id, input } = event.data || {};
  try {
    const Rankings = self.LeagueVectorIdpCurrentSeasonRankingsV01;
    if (!Rankings) throw new Error("IDP rankings runtime unavailable in worker");
    const contract = Rankings.buildCandidate(input || {});
    self.postMessage({ request_id, contract });
  } catch (error) {
    self.postMessage({
      request_id,
      error: error?.message || "unknown_worker_error",
    });
  }
};
