import { CrudFetcherKeyMap } from '../../../crud/CrudFetcher';

export type ContactMethodLog = {
  /** Row identifier */
  uid: string;
  /** Which contact method channel changed */
  channel: 'email' | 'phone' | 'push';
  /** The email address / phone number / push token */
  identifier: string;
  /** What action occurred */
  action:
    | 'create_verified'
    | 'create_unverified'
    | 'delete'
    | 'verify'
    | 'enable_notifs'
    | 'disable_notifs';
  /** The arbitrary reason dictionary for debugging */
  reason: any;
  /** When this log entry was stored */
  createdAt: Date;
};

/**
 * The key map that can be used to parse a contact method log from the backend
 */
export const contactMethodLogKeyMap:
  | CrudFetcherKeyMap<ContactMethodLog>
  | ((raw: any) => ContactMethodLog) = {
  created_at: (_, v) => ({ key: 'createdAt', value: new Date(v * 1000) }),
};
