import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ScreenResources } from '../../models/Screen';
import { Identity } from './hooks/useIdentities';
import { Entitlement } from './lib/createEntitlementRequestHandler';

export type SettingsResources = ScreenResources & {
  /** The identities the logged in user can use to login, or null if unavailable */
  identities: ValueWithCallbacks<Identity[] | null>;

  /** The users pro entitlement information, or null if unavailable */
  pro: ValueWithCallbacks<Entitlement | null>;
};
