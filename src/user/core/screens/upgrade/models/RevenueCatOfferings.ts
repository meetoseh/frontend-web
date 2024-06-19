import { CrudFetcherMapper, convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';
import { RevenueCatOffering, revenueCatOfferingKeyMap } from './RevenueCatOffering';

/**
 * The result of listing offerings from revenue cat
 */
export type RevenueCatOfferings = {
  /** The identifier of the current offering for this customer */
  currentOfferingId: string;
  /**
   * The available offerings; for our convenience endpoint which
   * proxies through our server we will only provide the offering
   * that we want to show, but we match the same structure as
   * https://www.revenuecat.com/docs/api-v1#tag/Project/operation/list-projects
   */
  offerings: RevenueCatOffering[];
};

export const revenueCatOfferingsKeyMap: CrudFetcherMapper<RevenueCatOfferings> = {
  current_offering_id: 'currentOfferingId',
  offerings: (_, v) => ({
    key: 'offerings',
    value: (v as any[]).map((i) => convertUsingMapper(i, revenueCatOfferingKeyMap)),
  }),
};
