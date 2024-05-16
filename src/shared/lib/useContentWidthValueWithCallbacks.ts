import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { ValueWithCallbacks } from './Callbacks';

/**
 * Determines the suggested width of the content area for a app-like screen,
 * after taking into account horizontal padding.
 */
export const useContentWidthValueWithCallbacks = (
  windowSizeImmediate: ValueWithCallbacks<{ width: number; height: number }>
): ValueWithCallbacks<number> => {
  return useMappedValueWithCallbacks(windowSizeImmediate, (ws) => {
    return Math.min(ws.width - 24, 342);
  });
};
