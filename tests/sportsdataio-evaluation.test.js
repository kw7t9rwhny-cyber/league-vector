const test = require("node:test");
const assert = require("node:assert/strict");

const {
  accessResult,
  evaluateEndpoint,
  runEvaluation,
  summarizePayload
} = require("../scripts/evaluate-sportsdataio.js");

test("sanitized payload summary keeps schema but not provider values", () => {
  const summary = summarizePayload([
    { PlayerID: 123, Name: "Scrambled Name", Position: "QB", Stats: { PassingYards: 4000 } },
    { PlayerID: 456, Name: "Another Name", Position: "LB", Stats: { Tackles: 100 } }
  ]);
  assert.equal(summary.kind, "array");
  assert.equal(summary.recordCount, 2);
  assert.deepEqual(summary.fieldNames, ["Name", "PlayerID", "Position", "Stats", "Stats.PassingYards", "Stats.Tackles"]);
  assert.doesNotMatch(JSON.stringify(summary), /Scrambled Name|Another Name|4000|100/);
});

test("HTTP statuses are converted to explicit access outcomes", () => {
  assert.equal(accessResult(200), "available");
  assert.equal(accessResult(401), "authentication-failed");
  assert.equal(accessResult(403), "not-in-trial-or-subscription");
  assert.equal(accessResult(429), "rate-limited");
  assert.equal(accessResult(500), "request-failed");
});

test("request uses the subscription header and does not put the key in the URL", async () => {
  const secret = "test-secret-that-must-not-appear-in-output";
  let capturedUrl;
  let capturedOptions;
  const fetchImpl = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok: true, status: 200, json: async () => [{ PlayerID: 1 }] };
  };
  const result = await evaluateEndpoint(
    { id: "players", purpose: "test", path: "/v3/nfl/scores/json/PlayersByAvailable" },
    secret,
    fetchImpl
  );
  assert.equal(capturedOptions.headers["Ocp-Apim-Subscription-Key"], secret);
  assert.doesNotMatch(capturedUrl, new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
});

test("evaluation rejects a missing secret before making requests", async () => {
  let calls = 0;
  await assert.rejects(
    runEvaluation({ apiKey: "", fetchImpl: async () => { calls += 1; } }),
    /missing or empty/
  );
  assert.equal(calls, 0);
});

test("evaluation report contains no API key or raw records", async () => {
  const secret = "another-test-secret";
  const report = await runEvaluation({
    apiKey: secret,
    definitions: [{ id: "idp", purpose: "test", path: "/idp" }],
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => [{ Name: "Scrambled Defender", Position: "LB", Tackles: 12 }]
    })
  });
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.doesNotMatch(serialized, /Scrambled Defender|\"LB\"|12/);
  assert.equal(report.secretStored, false);
  assert.equal(report.rawProviderDataStored, false);
});
