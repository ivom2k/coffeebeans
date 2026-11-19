// The longest message the widget takes, as the textarea's maxlength and the API's check. The
// column is varchar(1000).
export const maxFeedbackLength = 1000;

// How much feedback the table takes in a day (decisions log §6). The rate limiter's 5 an hour
// resets with every deploy; these are counted from the table, so they hold across one. The
// site-wide cap is there because a new address or a new Google account costs nothing.
export const feedbackLimits = { perSenderPerDay: 10, sitePerDay: 300 } as const;
