import { useCallback } from 'react';
import { useNetworkResponse } from '../../../../../shared/hooks/useNetworkResponse';
import { useWindowSizeValueWithCallbacks } from '../../../../../shared/hooks/useWindowSize';
import { adaptActiveVWCToAbortSignal } from '../../../../../shared/lib/adaptActiveVWCToAbortSignal';
import { apiFetch } from '../../../../../shared/ApiConstants';
import { convertUsingMapper } from '../../../../../admin/crud/CrudFetcher';
import { homeScreenImageMapper } from '../HomeScreenImage';
import { ValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useTimezone } from '../../../../../shared/hooks/useTimezone';
import { OsehImageProps } from '../../../../../shared/images/OsehImageProps';
import { useOsehImageStateValueWithCallbacks } from '../../../../../shared/images/useOsehImageStateValueWithCallbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { OsehImageStateRequestHandler } from '../../../../../shared/images/useOsehImageStateRequestHandler';
import { useStaleOsehImageOnSwap } from '../../../../../shared/images/useStaleOsehImageOnSwap';
import {
  OsehImageState,
  areOsehImageStatesEqual,
} from '../../../../../shared/images/OsehImageState';

/**
 * Determines and fetches the correct image for the top of the home screen.
 */
export const useHomeScreenImage = ({
  requiredVWC,
  imageHandler,
}: {
  /** True if the image is required, false for a perpetually loading image */
  requiredVWC: ValueWithCallbacks<boolean>;
  /** The image handler for loading the image */
  imageHandler: OsehImageStateRequestHandler;
}): ValueWithCallbacks<OsehImageState> => {
  const timezone = useTimezone();
  const loadPrevented = useMappedValueWithCallbacks(requiredVWC, (r) => !r);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const backgroundImageNR = useNetworkResponse(
    useCallback(
      (active, loginContext) => {
        return adaptActiveVWCToAbortSignal(active, async (signal) => {
          signal?.throwIfAborted();
          const response = await apiFetch(
            '/api/1/users/me/home_image?tz=' + encodeURIComponent(timezone) + '&tzt=browser',
            {
              method: 'GET',
              signal,
            },
            loginContext
          );
          if (!response.ok) {
            throw response;
          }
          const data = await response.json();
          return convertUsingMapper(data, homeScreenImageMapper);
        });
      },
      [timezone]
    ),
    { loadPrevented }
  );
  const backgroundImageDisplaySizeVWC = useMappedValueWithCallbacks(
    windowSizeVWC,
    () => ({
      width: windowSizeVWC.get().width,
      height: 258 + Math.max(Math.min(windowSizeVWC.get().height - 633, 92), 0),
    }),
    {
      outputEqualityFn: (a, b) => a.width === b.width && a.height === b.height,
    }
  );

  const backgroundImageProps = useMappedValuesWithCallbacks(
    [backgroundImageNR, requiredVWC, backgroundImageDisplaySizeVWC],
    (): OsehImageProps => {
      const req = requiredVWC.get();
      const himg = backgroundImageNR.get();
      const size = backgroundImageDisplaySizeVWC.get();
      return {
        uid: req && himg.type === 'success' ? himg.result.image.uid : null,
        jwt: req && himg.type === 'success' ? himg.result.image.jwt : null,
        displayWidth: size.width,
        displayHeight: size.height,
        alt: '',
      };
    }
  );

  const backgroundImageStateRawVWC = useOsehImageStateValueWithCallbacks(
    adaptValueWithCallbacksAsVariableStrategyProps(backgroundImageProps),
    imageHandler
  );

  const backgroundImageStateVWC = useStaleOsehImageOnSwap(
    useMappedValuesWithCallbacks(
      [backgroundImageNR, backgroundImageStateRawVWC],
      () => {
        const himg = backgroundImageNR.get();
        const state = backgroundImageStateRawVWC.get();
        if (himg.type !== 'success') {
          return state;
        }
        if (state.thumbhash !== null) {
          return state;
        }
        return { ...state, thumbhash: himg.result.thumbhash };
      },
      {
        outputEqualityFn: areOsehImageStatesEqual,
      }
    )
  );

  return backgroundImageStateVWC;
};
