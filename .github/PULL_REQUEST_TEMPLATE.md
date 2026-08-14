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

**Founder decision required:** No / `release | data-license | production-model-promotion | business-decision`

**Founder decision when required:** `pending | approved | rejected | request-changes`

**Integration required:** Yes / No

**Research promotion:** Raw `type:research` is never Core-eligible. Any integration/promotion must be a separate non-research work item that depends on the validated research PR/artifact; production model promotion is Founder-gated.

**Completion criteria:**

### Handoff rules

- `status:ready-for-qa` means the exact candidate head is frozen for QA.
- QA records `QA PASS — tested head <SHA>` or `QA FAIL — tested head <SHA>` on this PR.
- `status:qa-passed`, `status:ready-for-core`, and `status:live-test` require explicit PASS evidence bound to the current exact head. A new commit invalidates that approval.
- QA failure routes remediation to the original owner; preserve the verdict and produce a new exact head.
- `status:ready-for-core` requires fresh QA approval, satisfied dependencies, `integration-required`, and any required Founder decision already `approved`.
- Raw `type:research` cannot enter the Core queue even if `integration-required` is set accidentally.
- Founder-gated work may wait at `status:waiting-founder`; it cannot cross into `ready-for-core` or `live-test` unless the decision is `approved`. A rejected decision blocks progression.
- Automation must not merge or deploy from this contract.
