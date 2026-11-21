import { addDays, type IsoDate } from "@/lib/calc";

/**
 * The "Are you travelling?" prompt (§5.12). It only compares time zones: the
 * device's (from the browser) and the home zone in the profile. Nothing here
 * or anywhere else asks where the device is.
 */

/** The city part of an IANA zone, as a starting place for a trip: "Asia/Taipei" → "Taipei"; "" for "UTC". */
export function placeFromZone(zone: string): string {
  const parts = zone.split("/");
  return parts.length < 2 ? "" : parts[parts.length - 1].replaceAll("_", " ");
}

/**
 * "Start a trip" fills the new trip form with: the zone's city, today, and two
 * weeks (today + 13 days), ending the day before `nextTripStart` (the next
 * trip after today, if any) when two weeks would overlap it.
 */
export function suggestedTrip(
  zone: string,
  today: IsoDate,
  nextTripStart: IsoDate | null,
): { place: string; start: IsoDate; end: IsoDate } {
  const twoWeeks = addDays(today, 13);
  const end = nextTripStart && nextTripStart <= twoWeeks ? addDays(nextTripStart, -1) : twoWeeks;
  return { place: placeFromZone(zone), start: today, end: end < today ? today : end };
}

/** The trip that covers today, as the prompt needs it. */
export type CurrentTrip = { id: string; name: string; end: IsoDate };

export type TripPromptState = { kind: "start"; zone: string } | { kind: "end"; trip: CurrentTrip } | null;

type TripPromptInput = {
  deviceZone: string;
  homeZone: string;
  today: IsoDate;
  currentTrip: CurrentTrip | null;
  /** Whether the prompt with this key was dismissed on this device: "start:<zone>" or "end:<trip id>". */
  dismissed: (key: string) => boolean;
  /** Whether this device was seen away from home during the trip (see awayTripToRecord). */
  wasAway: (tripId: string) => boolean;
};

/**
 * The trip to remember as "was away" on this device: the trip covering today
 * while the device is in another zone. "Back home?" is only asked for a trip
 * the device was away for, so a trip taken in the home zone never asks.
 */
export function awayTripToRecord({
  deviceZone,
  homeZone,
  currentTrip,
}: Pick<TripPromptInput, "deviceZone" | "homeZone" | "currentTrip">): string | null {
  return deviceZone !== homeZone && currentTrip ? currentTrip.id : null;
}

/** The localStorage key remembering a dismissed prompt. */
export function promptKey(state: NonNullable<TripPromptState>): string {
  return state.kind === "start" ? `start:${state.zone}` : `end:${state.trip.id}`;
}

/**
 * Which prompt to show, if any:
 * - away from the home zone with no trip covering today: "Are you travelling? Start a trip?", once per device zone;
 * - back in the home zone while a trip covers today, after this device was away during it, and the trip
 *   doesn't already end today: "Back home? End your trip?", once per trip.
 */
export function tripPrompt({ deviceZone, homeZone, today, currentTrip, dismissed, wasAway }: TripPromptInput): TripPromptState {
  let state: TripPromptState = null;
  if (deviceZone !== homeZone && !currentTrip) state = { kind: "start", zone: deviceZone };
  else if (deviceZone === homeZone && currentTrip && currentTrip.end > today && wasAway(currentTrip.id)) {
    state = { kind: "end", trip: currentTrip };
  }
  return state && !dismissed(promptKey(state)) ? state : null;
}
