// The feedback widget and the admin inbox (decisions log §6). No imports: server/db/schema/
// imports this file, and the seed loads the schema through Node's own TypeScript support, which
// resolves neither aliases nor extensionless paths.

// The schema's CHECK is built from this list.
export const feedbackStatuses = ['NEW', 'READ', 'DONE'] as const;
export type FeedbackStatus = (typeof feedbackStatuses)[number];

// What the widget sends. `website` is the honeypot: hidden from people, so only a form-filling
// bot puts anything in it.
export type FeedbackInput = { message: string; pagePath: string | null; website?: string };

// One message in the admin inbox. Who sent it comes down to whether they were signed in: neither
// the address hash nor the account leaves the server. Dates are ISO strings, as JSON carries them.
export type FeedbackItem = {
  id: number;
  message: string;
  pagePath: string | null;
  signedIn: boolean;
  status: FeedbackStatus;
  createdAt: string;
};

// The badges in the admin menu.
export type InboxCounts = { newFeedback: number; pendingSuggestions: number };
