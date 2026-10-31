export type Verdict = 'PASS' | 'CONDITIONAL PASS' | 'NEEDS REVIEW' | 'FAIL';
export type CriterionStatus = 'pass' | 'partial' | 'fail' | 'needs-review';
export type Verification = 'verified' | 'user-provided' | 'unverified' | 'inferred';
export type SubmissionKind = 'document' | 'ai-response' | 'code' | 'competition' | 'qa-data';
export type SourceStatus = 'url' | 'user-provided' | 'not-found';
export type IssueStatus = 'open' | 'resolved' | 'wontfix';
export type Severity = 'low' | 'medium' | 'high';

export interface Criterion {
  id: string;
  name: string;
  /** Verbatim text from the source. Never paraphrased by Verdict. */
  officialWording: string;
  description: string;
  /** null means the weight is not published ("Not specified"). */
  weight: number | null;
  scale: string;
  requiredEvidence: string[];
  required: boolean;
  /** Eligibility / disqualification rule. Cannot be machine-verified. */
  disqualifying: boolean;
  keywords: string[];
  sourceUrl: string;
  verification: Verification;
  /** Parser confidence, 0..1. */
  confidence: number;
  ambiguities: string;
}

export interface RubricSnapshot {
  version: number;
  savedAt: string;
  note: string;
  criteria: Criterion[];
}

export interface Rubric {
  id: string;
  name: string;
  sourceUrl: string;
  sourceStatus: SourceStatus;
  sourceNote: string;
  fetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  criteria: Criterion[];
  history: RubricSnapshot[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  rubricId: string | null;
  baselineEvaluationId: string | null;
  createdAt: string;
}

export interface Evidence {
  quote: string;
  /** Character offsets in the submission, or -1 when unknown. */
  start: number;
  end: number;
  matchedTerms: string[];
}

export interface HumanOverride {
  status: CriterionStatus;
  score: number | null;
  reason: string;
  at: string;
}

export interface CriterionResult {
  criterionId: string;
  name: string;
  isRule: boolean;
  required: boolean;
  status: CriterionStatus;
  coverageScore: number | null;
  aiScore: number | null;
  score: number | null;
  evidence: Evidence[];
  weaknesses: string[];
  explanation: string;
  confidence: number;
  fix: string;
  aiNotes: string[];
  humanOverride?: HumanOverride;
}

export interface JudgeStatus {
  judge: string;
  ok: boolean;
  error?: string;
}

export interface AiRun {
  status: 'not-requested' | 'ok' | 'failed';
  judges: JudgeStatus[];
  disagreements: { criterionId: string; spread: number }[];
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface Evaluation {
  id: string;
  projectId: string | null;
  rubricId: string;
  rubricVersion: number;
  rubricName: string;
  kind: SubmissionKind;
  title: string;
  submission: string;
  createdAt: string;
  parentId: string | null;
  results: CriterionResult[];
  overallScore: number;
  weightedBasis: 'weighted' | 'equal';
  verdict: Verdict;
  verdictReasons: string[];
  disqualifiers: string[];
  injectionFlags: string[];
  ai: AiRun;
  humanApproved: boolean;
  /** The competition's own score, typed in by a person. Never computed by Verdict. */
  officialScore: string;
  audit: AuditEntry[];
}

export interface Issue {
  id: string;
  projectId: string | null;
  evaluationId: string;
  rubricId: string;
  criterionId: string;
  title: string;
  detail: string;
  severity: Severity;
  status: IssueStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByEvaluationId: string | null;
  note: string;
  manual: boolean;
}

export interface TestRun {
  at: string;
  result: 'pass' | 'fail' | 'blocked';
  note: string;
}

export interface TestCase {
  id: string;
  projectId: string | null;
  title: string;
  steps: string;
  expected: string;
  createdAt: string;
  runs: TestRun[];
}

export interface Settings {
  passThreshold: number;
  conditionalThreshold: number;
  failThreshold: number;
  regressionTolerance: number;
}

export interface AppState {
  version: 2;
  projects: Project[];
  rubrics: Rubric[];
  evaluations: Evaluation[];
  issues: Issue[];
  testCases: TestCase[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  passThreshold: 85,
  conditionalThreshold: 70,
  failThreshold: 50,
  regressionTolerance: 5,
};

export const emptyState = (): AppState => ({
  version: 2,
  projects: [],
  rubrics: [],
  evaluations: [],
  issues: [],
  testCases: [],
  settings: { ...DEFAULT_SETTINGS },
});
