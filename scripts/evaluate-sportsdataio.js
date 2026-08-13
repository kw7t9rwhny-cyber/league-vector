#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const API_ORIGIN = "https://api.sportsdata.io";
const DEFAULT_OUTPUT = "/tmp/league-vector-sportsdataio-evaluation.json";
const REQUEST_TIMEOUT_MS = 15_000;

function defaultSeason(now = new Date()) {
  const year = now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  return `${year}REG`;
}

function endpointDefinitions(season = defaultSeason(), week = "1") {
  return [
    {
      id: "team-profiles",
      purpose: "NFL team identity and metadata",
      path: "/v3/nfl/scores/json/TeamsBasic"
    },
    {
      id: "player-profiles",
      purpose: "Stable SportsDataIO player IDs and crosswalk fields",
      path: "/v3/nfl/scores/json/PlayersByAvailable"
    },
    {
      id: "offensive-season-projections",
      purpose: "Season-long offensive projection coverage",
      path: `/v3/nfl/projections/json/PlayerSeasonProjectionStats/${season}`
    },
    {
      id: "offensive-weekly-projections",
      purpose: "League-scored weekly offensive projection coverage",
      path: `/v3/nfl/projections/json/PlayerGameProjectionStatsByWeek/${season}/${week}`
    },
    {
      id: "idp-weekly-projections",
      purpose: "Weekly individual defensive player projection coverage",
      path: `/v3/nfl/projections/json/IdpPlayerGameProjectionStatsByWeek/${season}/${week}`
    }
  ];
}

function collectFieldNames(value, prefix = "", fields = new Set(), depth = 0) {
  if (!value || typeof value !== "object" || depth > 2) return fields;
  const sample = Array.isArray(value) ? value.slice(0, 3) : [value];
  for (const item of sample) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    for (const [key, child] of Object.entries(item)) {
      const field = prefix ? `${prefix}.${key}` : key;
      fields.add(field);
      if (child && typeof child === "object") collectFieldNames(child, field, fields, depth + 1);
    }
  }
  return fields;
}

function summarizePayload(payload) {
  const kind = Array.isArray(payload) ? "array" : payload === null ? "null" : typeof payload;
  const recordCount = Array.isArray(payload) ? payload.length : payload && typeof payload === "object" ? 1 : 0;
  const fieldNames = [...collectFieldNames(payload)].sort();
  return { kind, recordCount, fieldCount: fieldNames.length, fieldNames };
}

function accessResult(status) {
  if (status >= 200 && status < 300) return "available";
  if (status === 401) return "authentication-failed";
  if (status === 403) return "not-in-trial-or-subscription";
  if (status === 404) return "endpoint-not-found";
  if (status === 429) return "rate-limited";
  return "request-failed";
}

async function evaluateEndpoint(definition, apiKey, fetchImpl = fetch) {
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(`${API_ORIGIN}${definition.path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Ocp-Apim-Subscription-Key": apiKey
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    let schema = null;
    if (response.ok) {
      try {
        schema = summarizePayload(await response.json());
      } catch {
        schema = { kind: "unparseable", recordCount: 0, fieldCount: 0, fieldNames: [] };
      }
    }
    return {
      id: definition.id,
      purpose: definition.purpose,
      path: definition.path,
      status: response.status,
      access: accessResult(response.status),
      durationMs: Date.now() - startedAt,
      schema
    };
  } catch (error) {
    return {
      id: definition.id,
      purpose: definition.purpose,
      path: definition.path,
      status: null,
      access: error && error.name === "TimeoutError" ? "timed-out" : "network-failed",
      durationMs: Date.now() - startedAt,
      schema: null
    };
  }
}

async function runEvaluation(options = {}) {
  const apiKey = options.apiKey || process.env.SPORTSDATAIO_NFL_API_KEY;
  if (!apiKey || !apiKey.trim()) throw new Error("SPORTSDATAIO_NFL_API_KEY is missing or empty");

  const season = options.season || process.env.SPORTSDATAIO_NFL_SEASON || defaultSeason();
  const week = String(options.week || process.env.SPORTSDATAIO_NFL_WEEK || "1");
  const definitions = options.definitions || endpointDefinitions(season, week);
  const results = [];
  for (const definition of definitions) {
    results.push(await evaluateEndpoint(definition, apiKey, options.fetchImpl));
  }
  return {
    generatedAt: new Date().toISOString(),
    provider: "SportsDataIO NFL API",
    season,
    week,
    sanitized: true,
    secretStored: false,
    rawProviderDataStored: false,
    trialDataWarning: "Free-trial values are scrambled and may be used only to evaluate access and response structure.",
    results
  };
}

async function main() {
  const output = process.env.SPORTSDATAIO_EVALUATION_OUTPUT || DEFAULT_OUTPUT;
  try {
    const report = await runEvaluation();
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    const available = report.results.filter((result) => result.access === "available").length;
    console.log(`SportsDataIO evaluation complete: ${available}/${report.results.length} endpoints available.`);
    console.log(`Sanitized report written to ${output}. No key or raw provider records were stored.`);
  } catch (error) {
    console.error(`SportsDataIO evaluation could not run: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  accessResult,
  defaultSeason,
  endpointDefinitions,
  evaluateEndpoint,
  runEvaluation,
  summarizePayload
};
