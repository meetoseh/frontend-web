import { useCallback } from 'react';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { OsehImageProps, OsehImagePropsLoadable } from './OsehImageProps';
import { OsehImageState } from './OsehImageState';
import { OsehImageStateRequestHandler } from './useOsehImageStateRequestHandler';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';

const createLoadingState = (props: OsehImageProps): OsehImageState => ({
  localUrl: null,
  displayWidth: props.displayWidth ?? props.displayHeight,
  displayHeight: props.displayHeight ?? props.displayWidth,
  alt: props.alt,
  loading: true,
  placeholderColor: props.placeholderColor,
  thumbhash: null,
});

/**
 * Uses the given image props to produce an image state. This is analagous to
 * useOsehImageState, except the signature is modified to reduce the number
 * of react rerenders. Specifically, this will never trigger a react rerender.
 *
 * To render this state, use OsehImageFromStateValueWithCallbacks, which modifies
 * the dom directly and thus also doesn't trigger any react rerenders.
 *
 * It's generally not relevant which one is used unless the image state is being
 * lifted into a larger component (such as via a Feature implementation), in which
 * case it's very important for animation-heavy components to use this hook over
 * the react rerendering variation.
 *
 * @param props The image props to use to get the image state. If this value changes,
 *   in order to avoid react rerenders, it should be specified as a callbacks-style
 *   prop. Otherwise, standard react-rerender props are fine.
 * @param handler The handler to use for downloading images.
 */
export const useOsehImageStateValueWithCallbacks = (
  props: VariableStrategyProps<OsehImageProps>,
  handler: OsehImageStateRequestHandler
): ValueWithCallbacks<OsehImageState> => {
  const propsAsValueWithCallbacks = useVariableStrategyPropsAsValueWithCallbacks(props, {
    equalityFn: (a, b) =>
      a.uid === b.uid &&
      a.jwt === b.jwt &&
      a.displayWidth === b.displayWidth &&
      a.displayHeight === b.displayHeight &&
      (a.displayWidth === null || a.displayHeight === null ? a.compareAspectRatio : undefined) ===
        (b.displayWidth === null || b.displayHeight === null ? b.compareAspectRatio : undefined) &&
      a.alt === b.alt &&
      a.isPublic === b.isPublic &&
      a.placeholderColor === b.placeholderColor &&
      a.thumbhashOnly === b.thumbhashOnly,
  });

  const result = useWritableValueWithCallbacks<OsehImageState>(() =>
    createLoadingState(propsAsValueWithCallbacks.get())
  );

  useValueWithCallbacksEffect(
    propsAsValueWithCallbacks,
    useCallback(
      (props: OsehImageProps) => {
        if (props.uid === null) {
          return undefined;
        }

        const stateRef = handler.request(props as OsehImagePropsLoadable);
        stateRef.stateChanged.add(updateState);
        updateState();
        return () => {
          stateRef.stateChanged.remove(updateState);
          stateRef.release();
        };

        function updateState() {
          result.set(stateRef.state);
          result.callbacks.call(undefined);
        }
      },
      [handler, result]
    )
  );

  return result;
};
