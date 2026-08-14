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

**Founder decision required:** No / `release | data-license | production-model-promotion | business-decision`

**Integration required:** Yes / No

**Completion criteria:**

### Handoff rules

- `status:ready-for-qa` means the exact candidate head is frozen for QA.
- QA records `QA PASS — tested head <SHA>` or `QA FAIL — tested head <SHA>` on this PR.
- A head change after QA PASS invalidates the approval until re-reviewed.
- QA failure routes remediation to the original owner; preserve the verdict and produce a new exact head.
- `status:ready-for-core` requires fresh QA approval, satisfied dependencies, and `integration-required`.
- Founder-gated work stops at `status:waiting-founder`; automation must not merge/deploy it.
