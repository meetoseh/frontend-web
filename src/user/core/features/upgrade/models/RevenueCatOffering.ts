import { CrudFetcherMapper, convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';
import { RevenueCatPackage, revenueCatPackageKeyMap } from './RevenueCatPackage';

/**
 * An offering from RevenueCat
 */
export type RevenueCatOffering = {
  /** The stable identifier for the offering */
  identifier: string;
  /** The packages within the offering, in no particular order */
  packages: RevenueCatPackage[];
};

export const revenueCatOfferingKeyMap: CrudFetcherMapper<RevenueCatOffering> = {
  packages: (_, v) => ({
    key: 'packages',
    value: (v as any[]).map((i) => convertUsingMapper(i, revenueCatPackageKeyMap)),
  }),
};
