import { useEffect } from 'react';
import { useWritableValueWithCallbacks, ValueWithCallbacks } from '../../../shared/lib/Callbacks';
import {
  GUESSED_SILENT_AUTH_SUPPORT,
  isSilentAuthSupported,
} from '../../../shared/contexts/LoginContext';
import { setVWC } from '../../../shared/lib/setVWC';

type UseIsSilentAuthSupportedResult = {
  /** pending if the value might change, final if the value is final */
  type: 'pending' | 'final';
  /** true if silent auth is supported, false otherwise */
  value: boolean;
};

/**
 * Determines if silent auth support is available. The returned value should
 * be used for building the UI, but if avoiding flickering is required,
 * wait until the type is final before showing the UI.
 */
export const useIsSilentAuthSupportedVWC =
  (): ValueWithCallbacks<UseIsSilentAuthSupportedResult> => {
    const resultVWC = useWritableValueWithCallbacks(
      (): UseIsSilentAuthSupportedResult => ({
        type: 'pending',
        value: GUESSED_SILENT_AUTH_SUPPORT,
      })
    );

    useEffect(() => {
      let active = true;
      checkSilentAuthSupport();
      return () => {
        active = false;
      };

      async function checkSilentAuthSupport() {
        const supported = await isSilentAuthSupported();
        if (active) {
          setVWC(resultVWC, { type: 'final', value: supported } as const);
        }
      }
    });

    return resultVWC;
  };
