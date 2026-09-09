# Confidential R&D Boundary

## Purpose

This public repository is the source of truth for League Vector's public/product engineering. It is **not** an approved destination for unpublished confidential R&D, patent-sensitive technical detail, trade secrets, or counsel work product.

This policy is intentionally generic. It does not identify or describe confidential mechanisms.

## Classification

Before an agent, contributor, workflow, or reviewer writes technical material, classify it as one of:

- **PUBLIC** — safe for this public repository.
- **INTERNAL** — not approved for public disclosure.
- **PATENT-REVIEW** — potentially novel technical subject matter; keep confidential until patent strategy is resolved.
- **TRADE-SECRET** — confidential know-how whose value depends on secrecy.

If classification is uncertain, default to **PATENT-REVIEW** and do not publish the details here.

## Public-repository rule

Only **PUBLIC** material may be added to this repository.

Do not place INTERNAL, PATENT-REVIEW, or TRADE-SECRET material in:

- issues or issue comments;
- pull requests or review comments;
- commits or commit messages;
- repository files;
- workflow logs or artifacts intended for public access;
- generated documentation;
- release notes;
- discussions or wiki pages.

## Sensitive R&D examples

Keep unpublished implementation-specific mechanisms confidential when they concern potentially protectable or proprietary system behavior, including unpublished algorithms, optimization methods, evaluation recipes, promotion/rejection rules, confidential benchmarks, proprietary role contracts, non-public research corpora, secret thresholds, or unpublished system-control mechanisms.

Do not restate those mechanisms in public merely to explain that they are confidential.

## Agent and workflow rule

Autonomous agents must not treat this repository's public visibility as permission to disclose confidential R&D.

Before durable output, an agent or controller must determine the destination is authorized for the classification. If the destination is public and the output is not clearly PUBLIC, fail closed and escalate instead of publishing.

No agent may downgrade a classification merely to complete a task.

## Separation of authority

Public/product engineering may continue here. Confidential R&D should use an access-controlled private destination designated by the Founder.

Public interfaces may reference a private subsystem at a high level where necessary, but should not expose confidential internal algorithms or unpublished technical details.

## Existing public history

Do not delete, rewrite, or conceal existing public history for IP reasons without specific legal and engineering review. Historical public disclosure should instead be inventoried with dates and reviewed by qualified patent counsel.

## Disclosure rule

When in doubt:

**DO NOT PUBLISH — ESCALATE FOR IP REVIEW.**

This policy is an engineering confidentiality control, not legal advice.