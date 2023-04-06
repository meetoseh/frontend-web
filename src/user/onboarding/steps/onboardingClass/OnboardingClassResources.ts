import { MutableRefObject } from 'react';
import { JourneyShared } from '../../../journey/models/JourneyShared';
import { JourneyRef } from '../../../journey/models/JourneyRef';

export type OnboardingClassResources = {
  /**
   * The journey whose class should be shown, if loaded, otherwise null.
   */
  journey: JourneyRef | null;

  /**
   * The shared state of the journey whose class should be shown, if loaded, otherwise null.
   */
  shared: JourneyShared | null;

  /**
   * True if we're waiting for some resources before the screen can be
   * presented, false otherwise.
   */
  loading: boolean;

  /**
   * True if the audio is playing, false if it's not.
   */
  playing: MutableRefObject<boolean>;
};
