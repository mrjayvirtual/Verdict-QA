const PATTERNS: [RegExp, string][] = [
  [/ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i, 'Instruction-override phrase'],
  [/disregard\s+(the\s+|all\s+)?(system|previous|above|rubric|rules?)/i, 'Instruction-override phrase'],
  [/you\s+are\s+now\s+(a|an|the)\b/i, 'Role-reassignment phrase'],
  [/(reveal|print|show|repeat)\s+(your\s+|the\s+)?(system|hidden|developer)\s+prompt/i, 'Prompt-extraction phrase'],
  [/(give|assign|award)\s+(this|it|me)\s+(a\s+)?(perfect|full|maximum|100|top)\s*(score|marks?|rating)?/i, 'Score-manipulation phrase'],
  [/mark\s+(every|all)\s+criteri\w+\s+as\s+pass/i, 'Score-manipulation phrase'],
  [/<\/?\s*(system|assistant|instructions?|developer)\s*>/i, 'Fake control tag'],
];

/**
 * Flags text that tries to instruct the evaluator instead of being evaluated.
 * This is a heuristic tripwire, not a guarantee. A flag forces human review.
 */
export function scanInjection(text: string): string[] {
  const hits = new Set<string>();
  for (const [re, label] of PATTERNS) {
    const m = re.exec(text);
    if (m) hits.add(`${label}: "${m[0].slice(0, 80)}"`);
  }
  return [...hits];
}
