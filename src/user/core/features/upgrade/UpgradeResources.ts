import { InappNotificationSession } from '../../../../shared/hooks/useInappNotificationSession';
import { OsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';
import { UseRevenueCatOfferingsResult } from './hooks/useRevenueCatOfferings';
import { UseOfferingPriceResult } from './hooks/useOfferingPrice';

export type UpgradeResources = {
  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;

  /**
   * The in-app notification session, if it's been loaded, for this screen. Otherwise,
   * null
   */
  session: InappNotificationSession | null;

  /**
   * The offer we are presenting
   */
  offer: UseRevenueCatOfferingsResult;

  /**
   * The price of the offer we are presenting
   */
  offerPrice: UseOfferingPriceResult;

  /**
   * The image handler we use for series previews; by storing this here,
   * we can more quickly load the page when the user navigates back to it.
   */
  imageHandler: OsehImageStateRequestHandler;
};
