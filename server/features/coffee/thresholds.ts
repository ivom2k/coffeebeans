// Product rules that are meant to grow with the data (decisions log §2). Constants rather
// than environment config: raising one is a reviewed commit, and every environment ranks
// the same way. Feature functions take them as a parameter, so tests can pass their own.
export type Thresholds = {
  // Ratings a coffee needs for the ranked list; below that it is listed apart.
  minRatings: number;
  // Answers to the machine-issue question before a coffee's or a group's share counts.
  minIssueAnswers: number;
  // Share of answers reporting issues at which a coffee is flagged.
  issueFlagShare: number;
};

export const thresholds: Thresholds = {
  minRatings: 1,
  minIssueAnswers: 5,
  issueFlagShare: 0.4,
};
