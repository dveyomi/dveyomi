/**
 * English (UK): the source dictionary. Every other language must have exactly
 * these keys (its type is `Messages`), so a missing translation fails the build.
 * Strings, or functions for text with values in it (amounts come in already
 * formatted, so a dictionary never knows the currency).
 */
export const enGB = {
  common: {
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    back: "Back",
    continue: "Continue",
    delete: "Delete",
    edit: "Edit",
    done: "Done",
    saving: "Saving…",
    saved: "Saved.",
  },
  dates: {
    today: "Today",
    tomorrow: "Tomorrow",
    /** A date with its year, when the year isn't this one: "Friday 21 November 2025". */
    withYear: (date: string, year: string) => `${date} ${year}`,
    daysLeft: (n: number) => `${n} ${n === 1 ? "day" : "days"} left`,
  },
};

export type Messages = typeof enGB;
