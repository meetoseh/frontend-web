import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';

/**
 * The resources required to render the request phone step.
 */
export type RequestPhoneResources = {
  /**
   * The in-app notification session, which will either be for the standard
   * phone number notification or for the onboarding phone number notification,
   * as appropriate.
   */
  session: InappNotificationSession | null;

  /**
   * True if still waiting for more resources to load, false otherwise.
   */
  loading: boolean;
};
