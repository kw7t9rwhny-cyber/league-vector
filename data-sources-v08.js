(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LeagueVectorData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SLEEPER_API = "https://api.sleeper.app/v1";
  const SLEEPER_UNDOCUMENTED_API = "https://api.sleeper.app";
  const MARKET_URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/values-players.csv";
  const memory = new Map();

  function timeoutSignal(parentSignal, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
    const onAbort = () => controller.abort(parentSignal.reason || new DOMException("Cancelled", "AbortError"));
    if (parentSignal) parentSignal.addEventListener("abort", onAbort, { once: true });
    return {
      signal: controller.signal,
      cleanup() {
        clearTimeout(timer);
        if (parentSignal) parentSignal.removeEventListener("abort", onAbort);
      },
    };
  }

  function openDatabase() {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = indexedDB.open("league-vector-v08", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("responses")) {
          request.result.createObjectStore("responses", { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  async function cacheGet(key) {
    const inMemory = memory.get(key);
    if (inMemory && inMemory.expiresAt > Date.now()) return inMemory.value;
    const db = await openDatabase();
    if (!db) return null;
    return new Promise((resolve) => {
      const request = db.transaction("responses", "readonly").objectStore("responses").get(key);
      request.onsuccess = () => {
        const record = request.result;
        if (!record || record.expiresAt <= Date.now()) return resolve(null);
        memory.set(key, record);
        resolve(record.value);
      };
      request.onerror = () => resolve(null);
    });
  }

  async function cacheSet(key, value, ttlMs) {
    const record = { key, value, expiresAt: Date.now() + ttlMs };
    memory.set(key, record);
    const db = await openDatabase();
    if (!db) return;
    await new Promise((resolve) => {
      const transaction = db.transaction("responses", "readwrite");
      transaction.objectStore("responses").put(record);
      transaction.oncomplete = resolve;
      transaction.onerror = resolve;
    });
  }

  async function request(url, options = {}) {
    const { signal, ttlMs = 0, responseType = "json", timeoutMs = 15000 } = options;
    const key = `${responseType}:${url}`;
    if (ttlMs > 0) {
      const cached = await cacheGet(key);
      if (cached != null) return { value: cached, source: "cache" };
    }
    const timed = timeoutSignal(signal, timeoutMs);
    try {
      const response = await fetch(url, { signal: timed.signal });
      if (!response.ok) throw new Error(`Request returned ${response.status}`);
      const value = responseType === "text" ? await response.text() : await response.json();
      if (ttlMs > 0) await cacheSet(key, value, ttlMs);
      return { value, source: "network" };
    } finally {
      timed.cleanup();
    }
  }

  async function mapLimit(items, limit, mapper) {
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index], index);
      }
    });
    await Promise.all(workers);
    return results;
  }

  async function leagueBundle(leagueId, signal) {
    const short = 10 * 60 * 1000;
    const day = 24 * 60 * 60 * 1000;
    const urls = {
      league: `${SLEEPER_API}/league/${leagueId}`,
      users: `${SLEEPER_API}/league/${leagueId}/users`,
      rosters: `${SLEEPER_API}/league/${leagueId}/rosters`,
      players: `${SLEEPER_API}/players/nfl`,
      tradedPicks: `${SLEEPER_API}/league/${leagueId}/traded_picks`,
      state: `${SLEEPER_API}/state/nfl`,
    };
    const [league, users, rosters, players, tradedPicks, state] = await Promise.all([
      request(urls.league, { signal, ttlMs: short }),
      request(urls.users, { signal, ttlMs: short }),
      request(urls.rosters, { signal, ttlMs: short }),
      request(urls.players, { signal, ttlMs: day, timeoutMs: 30000 }),
      request(urls.tradedPicks, { signal, ttlMs: short }),
      request(urls.state, { signal, ttlMs: 5 * 60 * 1000 }),
    ]);
    return {
      league: league.value,
      users: users.value,
      rosters: rosters.value,
      players: players.value,
      tradedPicks: tradedPicks.value,
      state: state.value,
      cacheSources: Object.fromEntries(
        Object.entries({ league, users, rosters, players, tradedPicks, state }).map(([key, result]) => [key, result.source]),
      ),
    };
  }

  async function marketData(signal) {
    return request(MARKET_URL, {
      signal,
      ttlMs: 6 * 60 * 60 * 1000,
      responseType: "text",
      timeoutMs: 20000,
    });
  }

  async function projectionWeek(season, week, signal) {
    const params = new URLSearchParams({ season_type: "regular" });
    ["QB", "RB", "WR", "TE", "FLEX"].forEach((position) => params.append("position[]", position));
    const url = `${SLEEPER_UNDOCUMENTED_API}/projections/nfl/${season}/${week}?${params}`;
    return request(url, { signal, ttlMs: 60 * 60 * 1000, timeoutMs: 12000 });
  }

  async function seasonProjections(season, signal, progress = () => {}) {
    const weeks = Array.from({ length: 18 }, (_, index) => index + 1);
    const failures = [];
    let completed = 0;
    const results = await mapLimit(weeks, 4, async (week) => {
      try {
        return (await projectionWeek(season, week, signal)).value || [];
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        failures.push({ week, message: error.message });
        return [];
      } finally {
        completed += 1;
        progress(completed, weeks.length);
      }
    });
    return {
      rows: results.flat(),
      failures,
      status: failures.length === 0 ? "complete" : failures.length === weeks.length ? "unavailable" : "partial",
      source: "Sleeper undocumented projections endpoint",
      documented: false,
    };
  }

  async function transactionHistory(leagueId, maxRound, signal, progress = () => {}) {
    const rounds = Array.from({ length: Math.max(1, maxRound) }, (_, index) => index + 1);
    const failures = [];
    let completed = 0;
    const results = await mapLimit(rounds, 4, async (round) => {
      try {
        const result = await request(`${SLEEPER_API}/league/${leagueId}/transactions/${round}`, {
          signal,
          ttlMs: 10 * 60 * 1000,
        });
        return result.value || [];
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        failures.push({ round, message: error.message });
        return [];
      } finally {
        completed += 1;
        progress(completed, rounds.length);
      }
    });
    return {
      transactions: results.flat(),
      roundsScanned: rounds,
      failures,
      coverage: failures.length ? "partial" : "requested-rounds-complete",
    };
  }

  return {
    SLEEPER_API,
    MARKET_URL,
    request,
    cacheGet,
    cacheSet,
    mapLimit,
    leagueBundle,
    marketData,
    seasonProjections,
    transactionHistory,
  };
});
