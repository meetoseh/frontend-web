import { PEEK_RTT_TRACKER } from '../hooks/useScreenQueueState';

const ifDev =
  process.env.REACT_APP_ENVIRONMENT === 'dev'
    ? (fn: () => void): void => {
        fn();
      }
    : (_fn: () => void): void => {};

/**
 * Uses the current estimate of how long it takes to switch screens to adjust the
 * given exit transition duration.
 */
export const adaptExitTransition = async <T extends string, C extends { type: T; ms: number }>(
  exit: C
): Promise<C> => {
  if (exit.ms <= 0) {
    ifDev(() =>
      console.log('since exit transition duration <= 0, not considering estimated round trip time')
    );
    return exit;
  }
  const rawEstimateRTT = await PEEK_RTT_TRACKER.estimateRoundTripTime().promise;

  const estimateRTT = Math.max(0, Math.min(500, rawEstimateRTT));
  if (estimateRTT !== rawEstimateRTT) {
    ifDev(() =>
      console.warn(
        `estimated RTT for animation duration clipped from ${rawEstimateRTT}ms to ${estimateRTT}ms to avoid strange transitions`
      )
    );
  }

  const desiredExitMS = Math.ceil(estimateRTT / 25) * 25;
  if (exit.ms < desiredExitMS) {
    ifDev(() =>
      console.log(
        `ignoring suggested exit time of ${exit.ms}ms, using ${desiredExitMS}ms instead based on an estimated round trip time of ${estimateRTT}ms`
      )
    );
    return { ...exit, ms: desiredExitMS };
  }

  return exit;
};
