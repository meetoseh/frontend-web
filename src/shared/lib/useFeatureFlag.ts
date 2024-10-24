import { useEffect } from 'react';
import { WritableValueWithCallbacks, useWritableValueWithCallbacks } from './Callbacks';
import { setVWC } from './setVWC';

export type FeatureFlag = 'series';

export type FeatureFlagState = {
  [flag in FeatureFlag]: boolean;
};

/**
 * Fetches the current feature flags, for now stored locally.
 *
 * @returns the current value of the flag: null if loading, undefined if an error occurred,
 *   true if enabled, and false if disabled.
 */
export const useFeatureFlag = (
  flag: FeatureFlag
): WritableValueWithCallbacks<boolean | null | undefined> => {
  const result = useWritableValueWithCallbacks<boolean | null | undefined>(() => null);

  useEffect(() => {
    try {
      const parsedFlags = JSON.parse(
        localStorage.getItem('featureFlags') ?? sessionStorage.getItem('featureFlags') ?? '{}'
      ) as FeatureFlagState;
      setVWC(result, !!parsedFlags[flag]);
    } catch (e) {
      setVWC(result, undefined);
    }
  }, [result, flag]);

  return result;
};
