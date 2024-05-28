import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { JourneyShareableInfo } from './lib/createIsJourneyShareableRequestHandler';
import { JourneyLikeState } from './lib/createJourneyLikeStateRequestHandler';

export type JourneyFeedbackResources = ScreenResources & {
  /**
   * The background image to use
   */
  background: {
    image: ValueWithCallbacks<OsehImageExportCropped | null>;
    thumbhash: ValueWithCallbacks<string | null>;
  };

  /**
   * The share image to use
   */
  share: {
    image: ValueWithCallbacks<OsehImageExportCropped | null>;
    thumbhash: ValueWithCallbacks<string | null>;
    /** The size to render this image at, which updates faster than the actual image dimensions */
    sizeImmediate: ValueWithCallbacks<{ width: number; height: number }>;
  };
  /**
   * If the journey is shareable, or null if the shareability is unknown
   */
  isShareable: ValueWithCallbacks<JourneyShareableInfo | null>;
  /**
   * The object managing if the user has liked the journey, or null if not available
   */
  likeState: ValueWithCallbacks<JourneyLikeState | null>;
};
