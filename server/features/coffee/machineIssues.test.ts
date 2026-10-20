import { describe, expect, it } from 'vitest';
import { groupMachineIssues, issueFlag } from './machineIssues.ts';
import type { Thresholds } from './thresholds.ts';

const rules: Thresholds = { minRatings: 1, minIssueAnswers: 5, issueFlagShare: 0.4 };

describe('issueFlag', () => {
  it('Should_FlagTheCoffee_When_ShareReachesTheThreshold', () => {
    // Act: 2 of 5 is exactly 40 %.
    const flag = issueFlag({ answered: 5, withIssues: 2 }, rules);

    // Assert
    expect(flag).toEqual({ answered: 5, withIssues: 2 });
  });

  it('Should_NotFlagTheCoffee_When_ShareIsBelowTheThreshold', () => {
    // Act
    const flag = issueFlag({ answered: 6, withIssues: 2 }, rules);

    // Assert
    expect(flag).toBeNull();
  });

  it('Should_NotFlagTheCoffee_When_TooFewAnswered', () => {
    // Act: every answer reports issues, but "4 of 4" shouldn't hide a coffee.
    const flag = issueFlag({ answered: 4, withIssues: 4 }, rules);

    // Assert
    expect(flag).toBeNull();
  });
});

describe('groupMachineIssues', () => {
  it('Should_GroupAutomaticByManufacturerAndSumPortafilter_When_SummarisingACoffee', () => {
    // Arrange: rows as coffee_bean_machine_issue_summary returns them, one per kind and manufacturer.
    const rows = [
      { machineKind: 'AUTOMATIC' as const, manufacturerName: 'Duomatica', answered: 2, withIssues: 1 },
      { machineKind: 'AUTOMATIC' as const, manufacturerName: 'Veskimees', answered: 6, withIssues: 3 },
      { machineKind: 'PORTAFILTER' as const, manufacturerName: 'Kangpress', answered: 3, withIssues: 0 },
      { machineKind: 'PORTAFILTER' as const, manufacturerName: 'Veskimees', answered: 2, withIssues: 1 },
      { machineKind: null, manufacturerName: null, answered: 0, withIssues: 0 },
    ];

    // Act
    const groups = groupMachineIssues(rows, rules);

    // Assert: the grinder of an automatic machine is built in; portafilter users form one group.
    expect(groups).toEqual({
      automatic: [
        { manufacturerName: 'Veskimees', answered: 6, withIssues: 3, enoughAnswers: true },
        { manufacturerName: 'Duomatica', answered: 2, withIssues: 1, enoughAnswers: false },
      ],
      portafilter: { answered: 5, withIssues: 1, enoughAnswers: true },
      minAnswers: 5,
    });
  });

  it('Should_LeaveOutGroups_When_NobodyAnswered', () => {
    // Arrange: ratings with a machine whose raters skipped the question.
    const rows = [
      { machineKind: 'AUTOMATIC' as const, manufacturerName: 'Veskimees', answered: 0, withIssues: 0 },
      { machineKind: 'PORTAFILTER' as const, manufacturerName: 'Kangpress', answered: 0, withIssues: 0 },
    ];

    // Act
    const groups = groupMachineIssues(rows, rules);

    // Assert
    expect(groups).toEqual({ automatic: [], portafilter: null, minAnswers: 5 });
  });

  it('Should_ReportTheRulesMinimum_When_SummarisingACoffee', () => {
    // Arrange: a minimum other than the default, so a hard-coded value would fail.
    const rows = [{ machineKind: 'AUTOMATIC' as const, manufacturerName: 'Veskimees', answered: 3, withIssues: 1 }];

    // Act
    const groups = groupMachineIssues(rows, { ...rules, minIssueAnswers: 3 });

    // Assert: the page states the same minimum that decides enoughAnswers.
    expect(groups).toMatchObject({
      automatic: [{ manufacturerName: 'Veskimees', enoughAnswers: true }],
      minAnswers: 3,
    });
  });
});
