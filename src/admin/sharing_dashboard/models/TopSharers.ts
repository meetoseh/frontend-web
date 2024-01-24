import { CrudFetcherKeyMap, convertUsingKeymap } from '../../crud/CrudFetcher';

export type TopSharerCarouselItem = {
  sharer: TopSharer;
  list: 'allTime' | 'last30Days';
  position: number;
};

export type TopSharer = {
  sub: string;
  linksCreated: number;
  linkViewsTotal: number;
  linkViewsUnique: number;
  linkAttributableUsers: number;
};

export const topSharerKeyMap: CrudFetcherKeyMap<TopSharer> = {
  links_created: 'linksCreated',
  link_views_total: 'linkViewsTotal',
  link_views_unique: 'linkViewsUnique',
  link_attributable_users: 'linkAttributableUsers',
};

export type TopSharers = {
  topSharers: TopSharer[];
  checkedAt: Date;
};

export const topSharersKeyMap: CrudFetcherKeyMap<TopSharers> = {
  top_sharers: (_, v) => ({
    key: 'topSharers',
    value: (v as any[]).map((i) => convertUsingKeymap(i, topSharerKeyMap)),
  }),
  checked_at: (_, v) => ({ key: 'checkedAt', value: new Date(v * 1000) }),
};
