import { ValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { Identity } from '../../features/settings/hooks/useIdentities';
import { ScreenResources } from '../../models/Screen';
import { Entitlement } from './lib/createEntitlementRequestHandler';

export type SettingsResources = ScreenResources & {
  /** The identities the logged in user can use to login, or null if unavailable */
  identities: ValueWithCallbacks<Identity[] | null>;

  /** The users pro entitlement information, or null if unavailable */
  pro: ValueWithCallbacks<Entitlement | null>;
};
