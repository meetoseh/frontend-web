import { useWritableValueWithCallbacks, ValueWithCallbacks } from '../../../shared/lib/Callbacks';

type UseIsPasskeyAuthSupportedResult = {
  /** pending if the value might change, final if the value is final */
  type: 'pending' | 'final';
  /** true if passkey auth is supported, false otherwise */
  value: boolean;
};

/**
 * Determines if passkey support is available. The returned value should
 * be used for building the UI, but if avoiding flickering is required,
 * wait until the type is final before showing the UI.
 */
export const useIsPasskeyAuthSupportedVWC =
  (): ValueWithCallbacks<UseIsPasskeyAuthSupportedResult> => {
    return useWritableValueWithCallbacks(
      (): UseIsPasskeyAuthSupportedResult => ({
        type: 'final',
        value: !!(
          window &&
          window.navigator &&
          window.navigator.credentials &&
          window.navigator.credentials.get
        ),
      })
    );
  };
