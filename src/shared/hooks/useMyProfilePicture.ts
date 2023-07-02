import { useEffect } from 'react';
import { LoginContextValue } from '../contexts/LoginContext';
import { OsehImageState } from '../images/OsehImageState';
import { OsehImageStateRequestHandler } from '../images/useOsehImageStateRequestHandler';
import { OsehImageRef } from '../images/OsehImageRef';
import { apiFetch } from '../ApiConstants';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { Callbacks, ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useUnwrappedValueWithCallbacks } from './useUnwrappedValueWithCallbacks';

type MyProfilePictureStateProps = {
  /**
   * The current login context; profile pictures are always unavailable
   * when not logged in.
   */
  loginContext: LoginContextValue;

  /**
   * Desired display width of the image
   */
  displayWidth: number;

  /**
   * Desired display height of the image
   */
  displayHeight: number;

  /**
   * The image handler to use
   */
  handler: OsehImageStateRequestHandler;

  /**
   * True or undefined if the image should be loaded, false if it should
   * not be loaded. Allows conditional loading of the image.
   */
  load?: boolean;
};

export type MyProfilePictureState =
  | { state: 'loading' | 'unavailable'; image: null }
  | { state: 'available'; image: OsehImageState };

/**
 * Acts as a react hook for finding, selecting, and downloading the
 * current users profile picture.
 *
 * This requires react rerenders; if that's not desired, use
 * useMyProfilePictureStateValueWithCallbacks instead.
 *
 * @returns The current state of the profile picture
 */
export const useMyProfilePictureState = (
  props: MyProfilePictureStateProps
): MyProfilePictureState => {
  return useUnwrappedValueWithCallbacks(
    useMyProfilePictureStateValueWithCallbacks({
      type: 'react-rerender',
      props,
    })
  );
};

/**
 * Finds, selects, and downloads the current users profile picture, without
 * triggering any react rerenders.
 */
export const useMyProfilePictureStateValueWithCallbacks = (
  propsVariableStrategy: VariableStrategyProps<MyProfilePictureStateProps>
): ValueWithCallbacks<MyProfilePictureState> => {
  const state = useWritableValueWithCallbacks<MyProfilePictureState>(() => ({
    state: 'loading',
    image: null,
  }));
  const propsVWC = useVariableStrategyPropsAsValueWithCallbacks(propsVariableStrategy);

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    propsVWC.callbacks.add(handlePropsChanged);
    handlePropsChanged();
    return () => {
      propsVWC.callbacks.remove(handlePropsChanged);
      if (cleanup !== null) {
        cleanup();
        cleanup = null;
      }
    };

    function handlePropsChanged() {
      if (cleanup !== null) {
        cleanup();
        cleanup = null;
      }

      cleanup = handleProps(propsVWC.get()) ?? null;
    }

    function handleProps(props: MyProfilePictureStateProps): (() => void) | undefined {
      const loginContext = props.loginContext;
      const load = props.load;
      if (loginContext.state !== 'logged-in' || loginContext.userAttributes === null || !load) {
        if (state.get().state !== 'loading') {
          state.set({ state: 'loading', image: null });
          state.callbacks.call(undefined);
        }
        return;
      }

      let active = true;
      const cancelers = new Callbacks<undefined>();
      getImageRef();
      return () => {
        active = false;
        cancelers.call(undefined);
      };

      async function getImageRef(retryCounter = 0) {
        if (!active) {
          return;
        }

        try {
          const response = await apiFetch('/api/1/users/me/picture', {}, loginContext);
          if (!active) {
            return;
          }
          if (!response.ok) {
            if (response.status === 404) {
              const data = await response.json();
              if (data.type !== 'not_available' && retryCounter < 2) {
                setTimeout(getImageRef.bind(undefined, retryCounter + 1), 2500);
              } else {
                if (state.get().state !== 'unavailable') {
                  state.set({ state: 'unavailable', image: null });
                  state.callbacks.call(undefined);
                }
              }
              return;
            }

            const text = await response.text();
            if (!active) {
              return;
            }
            console.error("Couldn't fetch profile picture", response, text);
            if (state.get().state !== 'unavailable') {
              state.set({ state: 'unavailable', image: null });
              state.callbacks.call(undefined);
            }
            return;
          }

          const data: OsehImageRef = await response.json();
          if (!active) {
            return;
          }

          manageImage(data);
        } catch (e) {
          console.error("Couldn't fetch profile picture", e);
          if (state.get().state !== 'unavailable') {
            state.set({ state: 'unavailable', image: null });
            state.callbacks.call(undefined);
          }
        }
      }

      function manageImage(ref: OsehImageRef) {
        const request = props.handler.request({
          uid: ref.uid,
          jwt: ref.jwt,
          displayWidth: props.displayWidth,
          displayHeight: props.displayHeight,
          alt: 'profile',
        });

        request.stateChanged.add(handleStateChanged);
        cancelers.add(() => {
          request.release();
          request.stateChanged.remove(handleStateChanged);
        });
        handleStateChanged();

        function handleStateChanged() {
          state.set({
            state: 'available',
            image: request.state,
          });
          state.callbacks.call(undefined);
        }
      }
    }
  }, [propsVWC, state]);

  return state;
};
