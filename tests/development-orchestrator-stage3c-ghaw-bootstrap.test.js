"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const VERSION = "v0.37.18";
const URL = `https://github.com/github/gh-aw/releases/download/${VERSION}/linux-amd64`;
const EXPECTED_SHA256 = "626f8f73842581f08072f2e0bc8dd49cf4e7e70977186e582cff86ac2d472c04";

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error("too_many_redirects"));
    https.get(url, { headers: { "User-Agent": "league-vector-stage3c-compiler-bootstrap" } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return resolve(download(response.headers.location, destination, redirects + 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`download_failed_http_${response.statusCode}`));
      }
      const out = fs.createWriteStream(destination, { mode: 0o700 });
      response.pipe(out);
      out.on("finish", () => out.close(resolve));
      out.on("error", reject);
    }).on("error", reject);
  });
}

function run(binary, args) {
  const result = spawnSync(binary, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH || "",
      HOME: process.env.HOME || os.homedir(),
      CI: process.env.CI || "",
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS || ""
    }
  });
  if (result.status !== 0) throw new Error(`gh_aw_${args.join("_")}_failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function emitCompressed(marker, text) {
  console.log(`${marker}_GZIP_BASE64_BEGIN`);
  console.log(zlib.gzipSync(Buffer.from(text, "utf8"), { level: 9 }).toString("base64"));
  console.log(`${marker}_GZIP_BASE64_END`);
}

test("official gh-aw v0.37.18 compiles Stage 3C agent workflows without Codex execution", { timeout: 120000 }, async (t) => {
  if (process.env.GITHUB_ACTIONS !== "true") {
    t.skip("CI-only bootstrap compiler; no network/tool download during local unit tests");
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stage3c-ghaw-"));
  const binary = path.join(dir, "gh-aw");
  await download(URL, binary);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(binary)).digest("hex");
  assert.equal(digest, EXPECTED_SHA256);
  fs.chmodSync(binary, 0o700);

  run(binary, ["compile", "stage3c-research-worker", "--strict"]);
  run(binary, ["compile", "stage3c-qa-worker", "--strict"]);
  run(binary, ["validate", "stage3c-research-worker", "--strict"]);
  run(binary, ["validate", "stage3c-qa-worker", "--strict"]);

  const research = fs.readFileSync(path.join(ROOT, ".github/workflows/stage3c-research-worker.lock.yml"), "utf8");
  const qa = fs.readFileSync(path.join(ROOT, ".github/workflows/stage3c-qa-worker.lock.yml"), "utf8");
  assert.match(research, /Stage 3C Research Worker A/);
  assert.match(qa, /Stage 3C QA Worker B/);
  assert.doesNotMatch(research, /pull_request_target/);
  assert.doesNotMatch(qa, /pull_request_target/);

  emitCompressed("STAGE3C_RESEARCH_LOCK", research);
  emitCompressed("STAGE3C_QA_LOCK", qa);
});
