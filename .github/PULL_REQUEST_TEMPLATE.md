## League Vector work-item contract

**Objective:**

**Owner:** `owner:<role>`

**Risk:** `risk:low | risk:medium | risk:high`

**Status:** `status:<state>`

**Type:** `type:<kind>`

**Priority:** `priority:urgent | priority:high | priority:normal`

**Dependencies:** None, or list issue/PR identifiers and required state.

**Exact relevant SHA / source PR:**

**Production impact:** None / describe precisely.

**Validation required:**

**QA evidence when applicable:** `qa_verdict=pass|fail`; `qa_tested_sha=<exact SHA>`

**Integration required:** Yes / No

**Promotion type:** `none | experimental-integration | production-numerical-model`

**Promotion authorized:** `not-applicable | yes | no`

**Founder decision required:** No / `release | data-license | production-model-promotion | business-decision`

**Founder gate:** `none | release | data-license | production-model-promotion | business-decision`

**Founder decision when required:** `pending | approved | rejected | request-changes`

**Research/model promotion:** Raw `type:research` is never Core-eligible. Integration/promotion must be a separate non-research work item depending on validated research, with explicit promotion metadata. `production-numerical-model` automatically requires the Founder `production-model-promotion` gate.

**Completion criteria:**

### Handoff rules

- State-machine graph topology is not authorization. `structuralTransitionAllowed(from,to)` may describe the graph, but operational `transitionAllowed(item,from,to)` requires work-item metadata and fails closed when it is omitted or incomplete.
- `status:ready-for-qa` means the exact candidate head is frozen for QA.
- QA records `QA PASS — tested head <SHA>` or `QA FAIL — tested head <SHA>` on this PR.
- `status:qa-passed`, `status:ready-for-core`, and `status:live-test` require explicit PASS evidence bound to the current exact head. A new commit invalidates that approval.
- QA failure routes remediation to the original owner; preserve the verdict and produce a new exact head.
- `status:ready-for-core` requires fresh QA approval, satisfied dependencies, `integration-required`, a non-research integration artifact, required promotion authorization, and any required Founder decision already `approved`.
- Raw `type:research` cannot enter the Core queue even if `integration-required` is set accidentally.
- Founder-gated work may wait at `status:waiting-founder`; it cannot cross into `ready-for-core` or `live-test` unless the decision is `approved`. A rejected decision blocks progression.
- `production-numerical-model` cannot omit or downgrade the Founder gate: the validator requires `founder_decision_required=true` and `founder_gate=production-model-promotion`.
- The operational `validate-transition` CLI requires item metadata; a structurally valid edge with omitted metadata returns `allowed:false`.
- Automation must not merge or deploy from this contract.
