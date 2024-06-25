import {
  PurchasesStoreProduct,
  RecurrenceModeInfiniteRecurring,
} from '../models/PurchasesStoreProduct';

export type ISOUnit = 'd' | 'w' | 'm' | 'y';

export type ParsedPeriod = {
  unit: ISOUnit;
  count: number;
  iso8601: string;
};

/**
 * Extracts the length of the trial from the given store product
 * @param price The store product to extract the trial length from
 * @returns The trial length
 */
export const extractTrialLength = (price: PurchasesStoreProduct): ParsedPeriod | null => {
  if (price.defaultOption === null) {
    return null;
  }

  if (
    price.defaultOption.pricingPhases.length > 1 &&
    (price.defaultOption.pricingPhases[0].offerPaymentMode === 'FREE_TRIAL' ||
      price.defaultOption.pricingPhases[0].price.amountMicros === 0)
  ) {
    const trialPhase = price.defaultOption.pricingPhases[0];
    const trialPeriodIso8601 = trialPhase.billingPeriod.iso8601;

    if (
      trialPeriodIso8601.length >= 3 &&
      trialPeriodIso8601.length <= 5 &&
      trialPeriodIso8601[0].toLowerCase() === 'p'
    ) {
      const unitUnchecked = trialPeriodIso8601[trialPeriodIso8601.length - 1].toLowerCase();
      if (['d', 'w', 'm', 'y'].includes(unitUnchecked)) {
        const unit = unitUnchecked as 'd' | 'w' | 'm' | 'y';
        const count = parseInt(trialPeriodIso8601.slice(1, -1), 10);
        if (!isNaN(count) && count > 0) {
          if (trialPhase.billingCycleCount !== null && trialPhase.billingCycleCount > 1) {
            return {
              unit,
              iso8601: `P${count * trialPhase.billingCycleCount}${unit.toUpperCase()}`,
              count: count * trialPhase.billingCycleCount,
            };
          }

          return { unit, count, iso8601: trialPeriodIso8601 };
        }
      }
    }
  }

  return null;
};

/**
 * Extracts the time between payments in the infinite recurring part of the given store product
 *
 * @param price The store product to extract the paid interval length from
 * @returns The paid interval length
 */
export const extractPaidIntervalLength = (price: PurchasesStoreProduct): ParsedPeriod | null => {
  if (price.defaultOption === null || price.defaultOption.pricingPhases.length === 0) {
    return null;
  }

  const phase = price.defaultOption.pricingPhases[price.defaultOption.pricingPhases.length - 1];
  if (phase.recurrenceMode !== RecurrenceModeInfiniteRecurring) {
    return null;
  }

  const periodIso8601 = phase.billingPeriod.iso8601;
  if (
    periodIso8601.length >= 3 &&
    periodIso8601.length <= 6 &&
    periodIso8601[0].toLowerCase() === 'p'
  ) {
    const unitUnchecked = periodIso8601[periodIso8601.length - 1].toLowerCase();
    if (['d', 'w', 'm', 'y'].includes(unitUnchecked)) {
      const unit = unitUnchecked as 'd' | 'w' | 'm' | 'y';
      const count = parseInt(periodIso8601.slice(1, -1), 10);
      if (!isNaN(count) && count > 0) {
        if (phase.billingCycleCount !== null && phase.billingCycleCount > 1) {
          return {
            unit,
            iso8601: `P${count * phase.billingCycleCount}${unit.toUpperCase()}`,
            count: count * phase.billingCycleCount,
          };
        }

        return { unit, count, iso8601: periodIso8601 };
      }
    }
  }

  return null;
};
