import { OsehMediaContentState } from '../../../../shared/content/OsehMediaContentState';
import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { NetworkResponse } from '../../../../shared/hooks/useNetworkResponse';
import { OsehImageState } from '../../../../shared/images/OsehImageState';
import { OnboardingVideo } from '../../../../shared/models/OnboardingVideo';

/**
 * The resources required to actually display the welcome video
 */
export type WelcomeVideoResources = {
  /**
   * True if we need more time before presenting the welcome video, false if
   * we're ready to present the component
   */
  loading: boolean;

  /**
   * The in-app notification session, if it's been loaded, for this screen. Otherwise,
   * null
   */
  session: InappNotificationSession | null;

  /**
   * The actual onboarding video network response, for additional metadata when
   * desired (e.g., the onboarding video association row uid)
   */
  onboardingVideo: NetworkResponse<OnboardingVideo>;

  /**
   * The cover image to use for the welcome video
   */
  coverImage: OsehImageState;

  /**
   * The video to play
   */
  video: OsehMediaContentState<HTMLVideoElement>;
};
