import { CrudFetcherMapper } from '../../../crud/CrudFetcher';

export type UserClientScreenLog = {
  uid: string;
  user: {
    sub: string;
    givenName: string;
    familyName: string;
    createdAt: Date;
  };
  platform: 'browser' | 'ios' | 'android';
  visitor: string | null;
  screen: {
    slug: string;
    parameters: any;
  };
  createdAt: Date;
};

export const userClientScreenLogMapper: CrudFetcherMapper<UserClientScreenLog> = {
  user: (_, value) => ({
    key: 'user',
    value: {
      sub: value.sub,
      givenName: value.given_name,
      familyName: value.family_name,
      createdAt: new Date(value.created_at * 1000),
    },
  }),
  created_at: (_, value) => ({ key: 'createdAt', value: new Date(value * 1000) }),
};
