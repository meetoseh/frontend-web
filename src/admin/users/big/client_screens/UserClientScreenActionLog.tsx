import { CrudFetcherMapper } from '../../../crud/CrudFetcher';

export type UserClientScreenActionLog = {
  uid: string;
  userClientScreenLogUid: string;
  event: any;
  createdAt: Date;
};

export const userClientScreenActionLogMapper: CrudFetcherMapper<UserClientScreenActionLog> = {
  user_client_screen_log_uid: 'userClientScreenLogUid',
  created_at: (_, value) => ({ key: 'createdAt', value: new Date(value * 1000) }),
};
