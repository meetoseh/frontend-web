import { InappNotification } from '../../../../../shared/hooks/useInappNotification';
import { ValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { JourneyRef } from '../../../../journey/models/JourneyRef';
import { Emotion } from '../Emotion';

/**
 * The state used to decide if we should show the Extended Classes Pack
 * purchase prompt.
 */
export type ECPState = {
  /**
   * If loaded, the in-app notification for the extended classes pack
   */
  ian: InappNotification | null;

  /**
   * The emotion word the user selected, or null if they haven't selected
   * one. This is primarily for analytics.
   */
  emotion: Emotion | null;

  /**
   * The journey that we should take them to if they accept the offer to
   * sample the extended classes pack, or null if we asked the server for
   * this journey and the server indicated we shouldn't offer it, or undefined
   * if we haven't asked the server (possibly because it's unnecessary).
   *
   * We wrap this in a ValueWithCallbacks to avoid triggering rerenders when
   * it's loaded, since it's likely to load in the middle of the emotion
   * selection animation, and we really want to delay rerenders during that
   * time.
   */
  journey: ValueWithCallbacks<JourneyRef | null | undefined>;
};
