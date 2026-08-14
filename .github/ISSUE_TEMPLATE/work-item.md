---
name: League Vector work item
about: Persistent engineering handoff for research, implementation, QA, remediation, or integration
title: "[Area] Objective"
labels: []
assignees: []
---

## Objective

## Contract
- Owner: `owner:<role>`
- Risk: `risk:low | risk:medium | risk:high`
- Status: `status:active`
- Type: `type:<kind>`
- Priority: `priority:normal`
- Production impact: `none | describe`
- Integration required: `yes | no`
- Promotion type: `none | experimental-integration | production-numerical-model`
- Promotion authorized: `not-applicable | yes | no`
- Founder decision required: `no | release | data-license | production-model-promotion | business-decision`
- Founder gate: `none | release | data-license | production-model-promotion | business-decision`
- Founder decision: `not-required | pending | approved | rejected | request-changes`

## Dependencies
None, or list the exact issue/PR and required state.

## Relevant provenance
- Source PR/issue:
- Exact current head SHA/artifact:
- QA verdict when applicable: `pass | fail`
- QA tested SHA when applicable:

## Research / model promotion boundary
Raw `type:research` work is never Core-eligible. Any integration/promotion must be represented by a separate non-research work item that depends on the validated research artifact and explicitly names its `promotion_type`. Promotion items require `promotion_authorized=yes`. `production-numerical-model` automatically requires `Founder decision required=production-model-promotion`, `Founder gate=production-model-promotion`, and Founder approval before crossing into Core/live-test.

## Validation required

## Completion criteria

## Notes / blockers
