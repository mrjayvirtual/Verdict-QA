# Rubric Intelligence

Rubric Intelligence answers one question: **"What's the competition's judging rubric?"**

This document is the specification. Implementation status is tracked in [`ROADMAP.md`](ROADMAP.md).

## Principles

1. **Source-bound.** Every extracted criterion links to the official URL or document it came from.
2. **No invention.** If something is not published, it is recorded as `Not specified`, never estimated.
3. **Labelled certainty.** Every field carries a verification status.
4. **Disclosed absence.** If no official rubric is found, Verdict says so and asks the user to provide the rules.
5. **Untrusted input.** Retrieved pages and uploads are treated as data, never as instructions.

## Inputs

- Competition URLs (authorized public sources only)
- PDFs and documents
- Pasted requirements

## Data model

```ts
type VerificationStatus = 'verified' | 'inferred' | 'unknown';

interface Rubric {
  id: string;
  projectId: string;
  competitionName: string;
  version: number;              // incremented on every change to official requirements
  sourceUrls: string[];
  retrievedAt: string;          // ISO 8601
  criteria: Criterion[];
  eligibilityRules: Rule[];
  disqualificationRules: Rule[];
  weightsPublished: boolean;    // false => weighted scoring is disabled
  notes: string[];              // ambiguities and gaps, stated plainly
}

interface Criterion {
  id: string;
  officialWording: string;      // verbatim from the source
  description: string;
  weight: number | 'Not specified';
  scale: ScoringScale | 'Not specified';
  requiredEvidence: string[];
  sourceUrl: string;
  verification: VerificationStatus;
  confidence: number;           // 0..1, extraction confidence
  ambiguities: string[];
}

interface Rule {
  id: string;
  text: string;
  sourceUrl: string;
  verification: VerificationStatus;
}

interface ScoringScale {
  min: number;
  max: number;
  descriptors?: Record<number, string>;
}
```

## Verification statuses

| Status | Definition |
|---|---|
| `verified` | Directly present in an official source; wording and URL recorded |
| `inferred` | Reasonably implied but not stated; always shown with a warning |
| `unknown` | Not found; displayed as `Not specified` |

## Weights

- Weighted totals are computed **only** when official weights exist and sum correctly.
- When weights are unpublished, Verdict reports per-criterion results and does not fabricate an overall official score.
- Verdict's internal quality score is always shown separately from any official competition score.

## Versioning

When requirements change, a new rubric version is stored. Verdict records which prior evaluations used the older version and flags the impact so users can re-run them.

## Exports

Rubrics are editable and exportable as **JSON**, **CSV** and a **report**.

## Safety

- Fetch only from public, authorized sources; respect robots rules and rate limits.
- Strip and isolate instructions found inside retrieved content (prompt-injection defense).
- Validate all extracted structures against the schema before saving; reject malformed AI output.
