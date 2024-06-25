import { OsehImageExportCropped } from '../../../../shared/images/OsehImageExportCropped';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { PurchasesStoreProduct } from './models/PurchasesStoreProduct';
import { RevenueCatOffering } from './models/RevenueCatOffering';
import { ScreenResources } from '../../models/Screen';
import { ScreenImageParsed } from '../../models/ScreenImage';
import { UpgradeCopy } from './UpgradeParams';
import { ParsedPeriod } from './lib/purchasesStoreProductHelper';

export type UpgradeResources = ScreenResources & {
  /** The index of the package within the current offering that is selected */
  activePackageIdx: WritableValueWithCallbacks<number>;

  /** The copy to use */
  copy: ValueWithCallbacks<UpgradeCopy<ScreenImageParsed>>;

  /** The trial information, or null if no trial */
  trial: ValueWithCallbacks<ParsedPeriod | null>;

  /**
   * The display size the image is targeting, updated without a debounce
   * delay. The actual image content may not match this size until a debounce
   * period or longer.
   */
  imageSizeImmediate: ValueWithCallbacks<{ width: number; height: number }>;

  /**
   * The image to use. Until the image is loaded, use the thumbhash from
   * the params.
   */
  image: ValueWithCallbacks<OsehImageExportCropped | null>;

  /**
   * True if this screen should be immediately skipped if rendered, false otherwise
   */
  shouldSkip: ValueWithCallbacks<boolean>;

  /**
   * The offering to show
   */
  offering: ValueWithCallbacks<RevenueCatOffering | null>;

  /**
   * The prices based on the platform product identifier; not required in the
   * react-native app since this should be taken care of by revenuecat
   */
  prices: ValueWithCallbacks<Map<string, ValueWithCallbacks<PurchasesStoreProduct | null>>>;
};
