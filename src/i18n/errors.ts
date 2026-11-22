import { formatTripRange, type IsoDate } from "@/lib/calc";
import type { I18n } from "./format";

/** Details some errors keep so their message can be rebuilt in any language. */
type Details = {
  takenName?: string;
  balancePence?: number;
  fundName?: string;
  overspendStart?: IsoDate;
  other?: { name: string; startDate: IsoDate; endDate: IsoDate } | null;
};

/**
 * A data-layer error's message in the user's language, matched by the error's
 * name. The classes keep their English messages (logs and tests); anything not
 * listed here keeps its own message.
 */
export function localizeError(e: Error, { m, fmt, locale }: I18n): string {
  const d = e as Error & Details;
  const x = m.errors;
  switch (e.name) {
    case "NameTakenError":
      return d.takenName ? x.categoryTaken(d.takenName) : x.categoryTakenAny;
    case "CategoryInUseError":
      return x.categoryInUse;
    case "SavingsMovedError":
      return x.savingsMoved;
    case "NoBudgetError":
      return x.noBudget;
    case "BudgetChangedError":
      return x.budgetChanged;
    case "FeedbackLimitError": {
      const n = /\d+/.exec(e.message);
      return n ? x.feedbackLimit(Number(n[0])) : e.message;
    }
    case "SavingsAlreadyMovedError":
      return x.savingsAlreadyMoved;
    case "SplitTotalError":
      return x.splitTotal;
    case "FundNotFoundError":
      return x.fundNotFound;
    case "FundNameTakenError":
      return d.takenName ? x.fundTaken(d.takenName) : x.fundTakenAny;
    case "InsufficientFundsError":
      return x.insufficientFunds;
    case "FundShortError":
      return x.fundShort(d.fundName ?? "", fmt.money(Math.max(0, d.balancePence ?? 0)));
    case "SameFundError":
      return x.sameFund;
    case "ImportBatchNotFoundError":
      return x.importNotFound;
    case "AlreadyOnboardedError":
      return x.alreadyOnboarded;
    case "RuleNotFoundError":
      return x.ruleNotFound;
    case "RecurringChangedError":
      return x.recurringChanged;
    case "NotRecurringError":
      return x.notRecurring;
    case "AlreadyReviewedError":
      return x.alreadyReviewed;
    case "PeriodNotEndedError":
      return x.periodNotEnded;
    case "ReviewNotFoundError":
      return x.reviewNotFound;
    case "OverspendChoiceError":
      return x.overspendChoice;
    case "LeftoverChangedError":
      return d.overspendStart ? x.overspendChanged(fmt.month(d.overspendStart.slice(0, 7))) : x.leftoverChanged;
    case "RaiseRefusedError":
      return x.raiseRefused;
    case "MissingReferenceError":
      return x.missingReference;
    case "TransactionNotFoundError":
      return x.transactionNotFound;
    case "DuplicateOccurrenceError":
      return x.duplicateOccurrence;
    case "TripOverlapError":
      return d.other ? x.tripOverlap(d.other.name, formatTripRange(d.other.startDate, d.other.endDate, locale)) : x.tripOverlapAny;
    case "TripNotFoundError":
      return x.tripNotFound;
    case "TripNotCurrentError":
      return x.tripNotCurrent;
    default:
      return e.message;
  }
}
