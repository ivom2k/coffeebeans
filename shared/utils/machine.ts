// The most machines one account can save (CLAUDE.md § Access: whatever a user can create is
// bounded). Home, work and a few replacements fit many times over; without a limit, a loop
// against the add endpoint could fill the table.
export const maxMachinesPerAccount = 10;

// Whether an account that already has `count` machines may add another. One rule for the server,
// which refuses, and the account page, which hides the button, so the two can't disagree.
export const canAddMachine = (count: number): boolean =>
  count < maxMachinesPerAccount;
