import { JourneyRef } from '../../../../journey/models/JourneyRef';

/**
 * A journey ref with a function to call when we wanted to use the reference
 * but the jwt was expired. This is intended to be immutable; the reportExpired
 * function should cleanup whatever it is that is holding the ref, and initialize
 * a new version with a more recent jwt.
 */
export type ExpirableJourneyRef = {
  /** The underlying journey */
  journey: Pick<JourneyRef, 'uid' | 'jwt'>;
  /** The idempotent function that reports we wanted to use the ref but it was expired */
  reportExpired: () => void;
};
