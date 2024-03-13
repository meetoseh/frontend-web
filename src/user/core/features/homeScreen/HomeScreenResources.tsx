import { NetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { Emotion } from '../pickEmotionJourney/Emotion';

/**
 * Contains the resources required to display the home screen, as well as an
 * indicator if a spinner should be shown instead. Note that the `loading`
 * spinner will avoid resetting the animation state when multiple features are
 * being loaded in succession and thus is preferred over a feature-specific
 * loading overlay until the screen can at least be mostly rendered.
 *
 * Resources may be loaded early, in anticipation of the screen being shown,
 * without mounting the component.
 */
export type HomeScreenResources = {
  /** True if this feature is ready to display its component, false otherwise */
  loading: boolean;

  /** The image handler for loading images on the home screen */
  imageHandler: OsehImageStateRequestHandler;

  /** The background image for the top of the screen */
  backgroundImage: OsehImageState;

  /** The emotions that the user can choose from */
  emotions: NetworkResponse<Emotion[]>;

  /**
   * Starts preparing to go to the given emotion and returns a callback
   * to actually switch to that screen.
   */
  startGotoEmotion: (emotion: Emotion) => () => void;

  /** Changes to the series listing tab */
  gotoSeries: () => void;

  /** Changes to the account tab */
  gotoAccount: () => void;
};
