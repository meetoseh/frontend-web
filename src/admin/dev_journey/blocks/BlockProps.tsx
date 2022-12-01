import { JourneyRef } from '../DevJourneyApp';

export type BlockProps = {
  /**
   * The ref to the journey where the user is taking actions
   */
  journeyRef: JourneyRef;

  /**
   * The session within which the user is taking actions, null if
   * there is no relevant section at the moment.
   */
  sessionUID: string | null;

  /**
   * If the session is started and not left
   */
  running: boolean;

  /**
   * The current journey time within the session
   */
  journeyTime: number;
};
