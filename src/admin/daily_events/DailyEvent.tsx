/**
 * Describes a time when the generally available journeys rotate. A daily event
 * without a premiere time, aka available at, has no effect, and is primarily a
 * transient state during which journeys are being added.
 *
 * Despite the name, there are no restrictions on how long between daily events
 * except that there cannot be two with the same premiere time
 */
export type DailyEvent = {
  /**
   * The stable unique identifier for the daily event
   */
  uid: string;

  /**
   * When the daily event starts. If null the daily event is missing a premiere
   * time and will never become active. A daily event can only be edited when it
   * is not active, though the UI hides this detail.
   */
  availableAt: Date | null;

  /**
   * When the daily event was created.
   */
  createdAt: Date;

  /**
   * How many journeys are in this daily event.
   */
  numberOfJourneys: number;
};
