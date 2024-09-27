import { useWritableValueWithCallbacks, ValueWithCallbacks } from '../../../shared/lib/Callbacks';

type UseIsGoogleAuthSupportedResult = {
  /** pending if the value might change, final if the value is final */
  type: 'pending' | 'final';
  /** true if google auth is supported, false otherwise */
  value: boolean;
};

/**
 * Determines if google login support is available. The returned value should
 * be used for building the UI, but if avoiding flickering is required,
 * wait until the type is final before showing the UI.
 */
export const useIsGoogleAuthSupportedVWC =
  (): ValueWithCallbacks<UseIsGoogleAuthSupportedResult> => {
    return useWritableValueWithCallbacks((): UseIsGoogleAuthSupportedResult => {
      if (!window || !window.navigator || !window.navigator.userAgent) {
        return { type: 'final', value: false };
      }

      const userAgent = window.navigator.userAgent;

      const isInappBrowser = /(Instagram)|(FBAN)|(FBAV)/.test(userAgent);
      if (isInappBrowser) {
        return { type: 'final', value: false };
      }

      return { type: 'final', value: true };
    });
  };
