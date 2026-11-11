export type Finding = {
  title: string;
  impact: string;
  rule: string;
  element: string;
  evidence: string;
  fix: string;
  helpUrl?: string;
  occurrences?: number;
  elements?: { html: string; target?: string }[];
};

export type RecordItem = {
  id: string;
  url: string;
  date: string;
  scenario: string;
  source?: "real" | "simulation";
  findings?: Finding[];
  needsReview?: Finding[];
  engine?: string;
  failureReason?: string;
  checklistSize?: number;
  /** Regras marcadas como corrigidas no plano de correção. */
  fixPlan?: string[];
  answers: { [key: number]: { value: string; note: string } };
};
