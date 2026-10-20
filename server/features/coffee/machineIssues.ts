import type { CoffeeDetails, MachineIssueFlag, MachineIssueGroup } from '../../../shared/types/coffee.ts';
import type { Thresholds } from './thresholds.ts';

type IssueCounts = { answered: number; withIssues: number };

type IssueSummaryRow = IssueCounts & {
  machineKind: 'AUTOMATIC' | 'PORTAFILTER' | null;
  manufacturerName: string | null;
};

const hasEnoughAnswers = ({ answered }: IssueCounts, rules: Thresholds) => answered >= rules.minIssueAnswers;

// One rule for the list badge and the "few issues" filter, so the two never disagree.
export const issueFlag = (counts: IssueCounts, rules: Thresholds): MachineIssueFlag | null =>
  hasEnoughAnswers(counts, rules) && counts.withIssues / counts.answered >= rules.issueFlagShare
    ? { answered: counts.answered, withIssues: counts.withIssues }
    : null;

const toGroup = (counts: IssueCounts, rules: Thresholds): MachineIssueGroup => ({
  answered: counts.answered,
  withIssues: counts.withIssues,
  enoughAnswers: hasEnoughAnswers(counts, rules),
});

// Every issue code describes the grinder (decisions log §3). An automatic machine has it
// built in, so its manufacturer is the group; a portafilter user's grinder can be any
// brand, so they form one group. Rows without a machine are left out: the question
// follows the machine's kind, so they carry no answers.
export const groupMachineIssues = (
  rows: readonly IssueSummaryRow[],
  rules: Thresholds,
): CoffeeDetails['machineIssues'] => {
  const answeredRows = rows.filter(row => row.answered > 0);

  const automatic = answeredRows
    .flatMap(row => row.machineKind === 'AUTOMATIC' && row.manufacturerName !== null
      ? [{ manufacturerName: row.manufacturerName, ...toGroup(row, rules) }]
      : [])
    .toSorted((a, b) => b.answered - a.answered || a.manufacturerName.localeCompare(b.manufacturerName, 'et'));

  const portafilterRows = answeredRows.filter(row => row.machineKind === 'PORTAFILTER');
  const portafilter = portafilterRows.length === 0
    ? null
    : toGroup(portafilterRows.reduce(
        (sum, row) => ({ answered: sum.answered + row.answered, withIssues: sum.withIssues + row.withIssues }),
        { answered: 0, withIssues: 0 },
      ), rules);

  return { automatic, portafilter, minAnswers: rules.minIssueAnswers };
};
