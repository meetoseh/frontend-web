import { CrudFetcherMapper, convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';

export type ProductCategory = 'NON_SUBSCRIPTION' | 'SUBSCRIPTION' | 'UNKNOWN';

export const RecurrenceModeInfiniteRecurring = 1;
export const RecurrenceModeFiniteRecurring = 2;
export const RecurrenceModeNonRecurring = 3;
export type RecurrenceMode =
  | typeof RecurrenceModeInfiniteRecurring
  | typeof RecurrenceModeFiniteRecurring
  | typeof RecurrenceModeNonRecurring;

export type OfferPaymentMode = 'FREE_TRIAL' | 'SINGLE_PAYMENT' | 'DISCOUNTED_RECURRING_PAYMENT';

export type Period = {
  /** e.g., P1M for 1 month */
  iso8601: string;
};

export const periodKeyMap: CrudFetcherMapper<Period> = {};

export type Price = {
  /** e.g., $3.49 */
  formatted: string;
  amountMicros: number;
  /** unique identifier for the currency; only compare prices with the exact same currency */
  currencyCode: string;
};

export const priceKeyMap: CrudFetcherMapper<Price> = {
  amount_micros: 'amountMicros',
  currency_code: 'currencyCode',
};

export type PricingPhase = {
  /**
   * For DISCOUNTED_RECURRING_PAYMENT, the duration of the cycles.
   * For others, how long before moving on
   */
  billingPeriod: Period;

  /** How this phase recurs, if at all */
  recurrenceMode: RecurrenceMode;
  /**
   * For INFINITE_RECURRING and NON_RECURRING, null, otherwise, the number of
   * billing periods before this phase ends
   */
  billingCycleCount: number | null;
  /** The cost per cycle (if applicable, otherwise at the start) of this phase */
  price: Price;
  /** How the uesr pays for this phase, if not an infinite recurring subscription */
  offerPaymentMode: OfferPaymentMode | null;
};

export const pricingPhaseKeyMap: CrudFetcherMapper<PricingPhase> = {
  billing_period: (_, v) => ({ key: 'billingPeriod', value: convertUsingMapper(v, periodKeyMap) }),
  recurrence_mode: 'recurrenceMode',
  billing_cycle_count: 'billingCycleCount',
  price: (_, v) => ({ key: 'price', value: convertUsingMapper(v, priceKeyMap) }),
  offer_payment_mode: 'offerPaymentMode',
};

export type SubscriptionOption = {
  /** The phases of the subscription in the order they occur */
  pricingPhases: PricingPhase[];
};

export const subscriptionOptionKeyMap: CrudFetcherMapper<SubscriptionOption> = {
  pricing_phases: (_, v) => ({
    key: 'pricingPhases',
    value: (v as any[]).map((v) => convertUsingMapper(v, pricingPhaseKeyMap)),
  }),
};

export type PurchasesStoreProduct = {
  /**
   * The price in the currency, NOT intended for display. Unless zero, may be slightly
   * inaccurate
   */
  price: number;
  /** A unique identifier for the currency the price is in */
  currencyCode: string;
  /** The exact price and currency code together, e.g., $3.49 */
  priceString: string;
  /** The category of the product; treat unknown like NON_SUBSCRIPTION */
  productCategory: ProductCategory;
  /** If this is subscription-like, describes the subscription as a sequence of phases */
  defaultOption: SubscriptionOption | null;
};

export const purchasesStoreProductKeyMap: CrudFetcherMapper<PurchasesStoreProduct> = {
  currency_code: 'currencyCode',
  price_string: 'priceString',
  product_category: 'productCategory',
  default_option: (_, v) => ({
    key: 'defaultOption',
    value: v !== null && v !== undefined ? convertUsingMapper(v, subscriptionOptionKeyMap) : null,
  }),
};
