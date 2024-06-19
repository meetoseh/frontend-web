import { CrudFetcherMapper } from '../../../../../admin/crud/CrudFetcher';

/** Describes a revenue cat package */
export type RevenueCatPackage = {
  /** The package's identifier */
  identifier: string;

  /** The platform-specific product identifier; for web this is a stripe product id */
  platformProductIdentifier: string;
};

export const revenueCatPackageKeyMap: CrudFetcherMapper<RevenueCatPackage> = {
  platform_product_identifier: 'platformProductIdentifier',
};
