---
name: League Vector Product Task Pipeline v0.1
description: Bounded implementation lane for one separately approved public-safe product task contract
on:
  workflow_dispatch:
    inputs:
      task_contract_issue_number:
        description: Exact public issue number containing one Founder-approved v0.1 task contract
        required: true
        type: string

permissions:
  contents: read
  issues: read
  pull-requests: read
  actions: read

concurrency:
  group: lv-product-task-v01-${{ inputs.task_contract_issue_number }}
  cancel-in-progress: false

engine:
  id: codex
  version: "0.147.0"
model: gpt-5.4-mini

max-ai-credits: 1000
max-daily-ai-credits: 1000
max-turns: 40
timeout-minutes: 20

network:
  allowed:
    - defaults
    - github
    - node
    - playwright
    - linux-distros

tools:
  edit:
  bash:
    - "*"

checkout:
  repository: ${{ github.repository }}
  ref: ${{ needs.preflight.outputs.starting_commit }}
  fetch-depth: 0

jobs:
  preflight:
    name: Validate frozen product task contract
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
      issues: write
    outputs:
      task_contract_identity: ${{ steps.preflight.outputs.task_contract_identity }}
      idempotency_identity: ${{ steps.preflight.outputs.idempotency_identity }}
      implementation_run_identity: ${{ steps.preflight.outputs.implementation_run_identity }}
      starting_commit: ${{ steps.preflight.outputs.starting_commit }}
      starting_tree: ${{ steps.preflight.outputs.starting_tree }}
      contract_artifact_name: ${{ steps.preflight.outputs.contract_artifact_name }}
      allowed_files_json: ${{ steps.preflight.outputs.allowed_files_json }}
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - id: preflight
        name: Fail closed before inference
        env:
          GH_TOKEN: ${{ github.token }}
          CONTRACT_ISSUE_NUMBER: ${{ inputs.task_contract_issue_number }}
        run: node scripts/product-task-pipeline-v01.js preflight "$CONTRACT_ISSUE_NUMBER"
      - name: Preserve the exact admitted contract for the isolated worker
        uses: actions/upload-artifact@v7
        with:
          name: ${{ steps.preflight.outputs.contract_artifact_name }}
          path: ${{ steps.preflight.outputs.contract_file }}
          retention-days: 7
          if-no-files-found: error

  agent:
    needs: [preflight]

  conclusion:
    pre-steps:
      - name: Reject missing validation handoff
        env:
          DISPATCH_VALIDATION_RESULT: ${{ needs.dispatch_validation.result }}
        run: test "$DISPATCH_VALIDATION_RESULT" = "success"

safe-outputs:
  report-failure-as-issue: false
  threat-detection:
    max-ai-credits: 400
  max-patch-size: 512
  concurrency-group: lv-product-task-safe-output-${{ inputs.task_contract_issue_number }}
  jobs:
    dispatch-validation:
      description: Bind the created draft PR to immutable identities and dispatch exact-head validation
      needs: safe_outputs
      runs-on: ubuntu-latest
      permissions:
        contents: read
        issues: write
        pull-requests: read
        actions: write
      inputs:
        confirmation:
          description: Confirm creator commands passed and the one draft PR may enter deterministic validation
          required: true
          type: boolean
      steps:
        - uses: actions/checkout@v7
          with:
            persist-credentials: false
        - uses: actions/setup-node@v7
          with:
            node-version: 22
        - name: Require exactly one confirmed validation request and one created PR
          env:
            CREATED_PR_NUMBER: ${{ needs.safe_outputs.outputs.created_pr_number }}
          run: |
            case "$CREATED_PR_NUMBER" in
              ''|*[!0-9]*|0) exit 1 ;;
            esac
            node -e 'const fs=require("node:fs");const o=JSON.parse(fs.readFileSync(process.env.GH_AW_AGENT_OUTPUT,"utf8"));const x=o.items.filter(v=>v.type==="dispatch_validation");if(x.length!==1||x[0].confirmation!==true)process.exit(1)'
        - name: Re-read exact candidate and dispatch one validation workflow
          env:
            GH_TOKEN: ${{ github.token }}
            CONTRACT_ISSUE_NUMBER: ${{ inputs.task_contract_issue_number }}
            CREATED_PR_NUMBER: ${{ needs.safe_outputs.outputs.created_pr_number }}
          run: node scripts/product-task-pipeline-v01.js dispatch-validation "$CONTRACT_ISSUE_NUMBER" "$CREATED_PR_NUMBER"
  create-pull-request:
    max: 1
    draft: true
    base-branch: main
    allowed-branches:
      - agent/product-task-*
    preserve-branch-name: false
    auto-close-issue: false
    expires: 14
    title-prefix: "[product-task] "
    max-patch-files: 20
    max-patch-size: 512
    protected-files: blocked
    allowed-files:
      - "*.js"
      - "*.css"
      - "*.html"
      - "scripts/*.js"
      - "lib/*.js"
      - "tests/*.test.js"
      - "docs/*.md"
      - "protocol/product-*/**"
      - "assets/**"

steps:
  - name: Download exact admitted task contract
    uses: actions/download-artifact@v8
    with:
      name: ${{ needs.preflight.outputs.contract_artifact_name }}
      path: /tmp/gh-aw/agent/product-task-pipeline-v01

post-steps:
  - name: Restore the immutable verifier from the admitted base
    if: always()
    env:
      ADMITTED_STARTING_COMMIT: ${{ needs.preflight.outputs.starting_commit }}
    run: |
      set -euo pipefail
      verifier_root="$RUNNER_TEMP/product-task-pipeline-v01-verifier"
      mkdir -p "$verifier_root/scripts" "$verifier_root/lib"
      git show "$ADMITTED_STARTING_COMMIT:scripts/product-task-pipeline-v01.js" > "$verifier_root/scripts/product-task-pipeline-v01.js"
      git show "$ADMITTED_STARTING_COMMIT:lib/product-task-pipeline-v01.js" > "$verifier_root/lib/product-task-pipeline-v01.js"
      chmod 0555 "$verifier_root/scripts/product-task-pipeline-v01.js" "$verifier_root/lib/product-task-pipeline-v01.js"
  - name: Deterministically enforce candidate boundary and creator commands with the immutable verifier
    if: always()
    env:
      GH_TOKEN: ${{ github.token }}
      CONTRACT_ISSUE_NUMBER: ${{ inputs.task_contract_issue_number }}
      TASK_CONTRACT_IDENTITY: ${{ needs.preflight.outputs.task_contract_identity }}
    run: node "$RUNNER_TEMP/product-task-pipeline-v01-verifier/scripts/product-task-pipeline-v01.js" creator-verify "$CONTRACT_ISSUE_NUMBER" "$TASK_CONTRACT_IDENTITY"

sandbox:
  agent:
    sudo: false
---

# League Vector Product Task Implementation Worker v0.1

You are one bounded implementation worker. The durable task contract is at
`/tmp/gh-aw/agent/product-task-pipeline-v01/task-contract.json`. Its admitted identity is
`${{ needs.preflight.outputs.task_contract_identity }}` and its exact allowed-files list is
`${{ needs.preflight.outputs.allowed_files_json }}`.

Before editing, read that contract and verify the checkout is exactly its starting commit and tree. Implement only its objective, and edit only the exact files listed in `allowed_files`. The static safe-output profile is an additional ceiling; it never expands the task-specific list.

You must not modify workflows, dependencies, package manifests or lockfiles, data, credentials, deployment or payment paths, agent instructions, this pipeline's verifier/protocol/operator files, Router control, VectorOS Cycle #2, MLP, main, or any other prohibited path/action. Do not fetch credentials, configure a credential helper, push directly, merge, deploy, release, close an issue, approve or review your own work, deliver to a customer, or make source-rights conclusions.

Run every `required_deterministic_commands` entry in order. Repair only within this single execution and within the frozen file boundary. Re-run the failed command after a repair and then re-run the complete command list. Do not create a retry loop or a second PR. Commit a clean, bounded candidate on a branch beginning `agent/product-task-`.

Only after the creator commands pass, request exactly one `create_pull_request` safe output and exactly one `dispatch_validation` safe output with `confirmation: true`. The deterministic dispatch job waits for safe PR creation and derives the actual PR number, commit, tree, base, and changed paths itself. The PR must remain draft, target `main`, and explain the exact task-contract identity, starting commit/tree, candidate commit/tree, changed paths, commands run, limitations, and that fresh independent read-only QA is still required. Do not use closing keywords.

If the contract, authority, repository identity, cost authority, file boundary, tests, or safe-output requirement cannot be satisfied, make no PR and return BLOCKED or FAIL_SAFE with the exact reason. Never weaken exact-head validation or QA to obtain a green result.
