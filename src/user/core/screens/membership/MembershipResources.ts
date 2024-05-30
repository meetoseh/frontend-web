import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { Entitlement } from '../settings/lib/createEntitlementRequestHandler';

export type MembershipResources = ScreenResources & {
  /** The users pro entitlement information, or null if unavailable */
  pro: ValueWithCallbacks<Entitlement | null>;

  /** The url that the user can go to to manage their membership, or null if unavailable */
  manageUrl: ValueWithCallbacks<{ url: string; expiresAt: Date; reportExpired: () => void } | null>;
};
