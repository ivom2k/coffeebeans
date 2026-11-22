// How much one account, and the whole site, may have waiting for review (decisions log §6).
// Google accounts cost nothing, so the site-wide caps are what bound the disk: 500 photos are
// about 200 MB. Counted from the table, so they hold across a deploy, unlike the rate limiter.
export const suggestionLimits = {
  pendingPerAccount: 10,
  newPerAccountPerDay: 10,
  pendingSiteWide: 2000,
  pendingPhotosSiteWide: 500,
} as const;

// The longest value each field takes, as the inputs' maxlength and the API's check. Together they
// keep `details` well inside the 2000 bytes suggestion_details_size_chk allows.
export const suggestionFieldLengths = { name: 150, url: 500, manufacturer: 100, model: 100 } as const;

// The largest photo the server takes. The form downsizes a photo to at most 2000 px as JPEG
// before sending it, a few hundred kilobytes; this is for the original it falls back to.
export const maxSuggestionPhotoBytes = 6 * 1024 * 1024;

// The longest side the form downsizes a photo to before sending it.
export const suggestionPhotoUploadBound = 2000;
