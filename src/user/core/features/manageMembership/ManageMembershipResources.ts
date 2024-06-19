import { ReactElement } from 'react';
import { Period } from '../../screens/upgrade/models/PurchasesStoreProduct';

export type MMRecurrenceRecurring = {
  type: 'recurring';
  period: Period;
  cycleEndsAt: Date;
  autoRenews: boolean;
};
export type MMRecurrenceLifetime = { type: 'lifetime' };
export type MMRecurrence = MMRecurrenceRecurring | MMRecurrenceLifetime;

export type HaveProLoading = {
  type: 'loading';
  value?: undefined;
  recurrence?: undefined;
  platform?: undefined;
  manageUrl?: undefined;
  error?: undefined;
};

export type HaveProLoadedFalse = {
  type: 'loaded';
  value: false;
  recurrence?: undefined;
  platform?: undefined;
  manageUrl?: undefined;
  error?: undefined;
};

export type HaveProLoadedStripe = {
  type: 'loaded';
  value: true;
  recurrence: MMRecurrence;
  platform: 'stripe';
  /**
   * The url to the users customer portal
   * https://docs.stripe.com/customer-management#customer-portal-features
   */
  manageUrl: string;
  error?: undefined;
};

export type HaveProLoadedGeneric = {
  type: 'loaded';
  value: true;
  recurrence: MMRecurrence;
  platform: 'ios' | 'google' | 'promotional';
  manageUrl?: undefined;
  error?: undefined;
};

export type HaveProError = {
  type: 'error';
  value?: undefined;
  recurrence?: undefined;
  platform?: undefined;
  manageUrl?: undefined;
  error: ReactElement;
};

export type HavePro =
  | HaveProLoading
  | HaveProLoadedFalse
  | HaveProLoadedStripe
  | HaveProLoadedGeneric
  | HaveProError;

export type ManageMembershipResources = {
  /**
   * True if some resources are still being loaded, false if the screen is
   * ready to present.
   */
  loading: boolean;

  /**
   * Whether the user has a pro subscription or not, and if so, when it expires.
   * For stripe, this also includes the url to their customer portal
   */
  havePro: HavePro;

  /** Should be called if the user wants to return home via the navbar, false otherwise */
  gotoHome: () => void;

  /** Should be called if the user wants to go to the series list screen. */
  gotoSeries: () => void;

  /** Returns to the settings page, for the back button or account button in nav */
  gotoSettings: () => void;

  /** Goes to the upgrade to Oseh+ screen */
  gotoUpgrade: () => void;
};
