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

/** "Start a trip" fills the new trip form with: the zone's city, today, and two weeks (today + 13 days). */
export function suggestedTrip(zone: string, today: IsoDate): { place: string; start: IsoDate; end: IsoDate } {
  return { place: placeFromZone(zone), start: today, end: addDays(today, 13) };
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
};

/** The localStorage key remembering a dismissed prompt. */
export function promptKey(state: NonNullable<TripPromptState>): string {
  return state.kind === "start" ? `start:${state.zone}` : `end:${state.trip.id}`;
}

/**
 * Which prompt to show, if any:
 * - away from the home zone with no trip covering today: "Are you travelling? Start a trip?", once per device zone;
 * - back in the home zone while a trip covers today (and doesn't already end today): "Back home? End your trip?", once per trip.
 */
export function tripPrompt({ deviceZone, homeZone, today, currentTrip, dismissed }: TripPromptInput): TripPromptState {
  let state: TripPromptState = null;
  if (deviceZone !== homeZone && !currentTrip) state = { kind: "start", zone: deviceZone };
  else if (deviceZone === homeZone && currentTrip && currentTrip.end > today) state = { kind: "end", trip: currentTrip };
  return state && !dismissed(promptKey(state)) ? state : null;
}
