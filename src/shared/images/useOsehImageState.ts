import { useEffect, useState } from 'react';
import { OsehImageProps, OsehImagePropsLoadable } from './OsehImageProps';
import { OsehImageState } from './OsehImageState';
import { OsehImageStateRequestHandler } from './useOsehImageStateRequestHandler';

const createLoadingState = (props: OsehImageProps): OsehImageState => ({
  localUrl: null,
  displayWidth: props.displayWidth,
  displayHeight: props.displayHeight,
  alt: props.alt,
  loading: true,
  placeholderColor: props.placeholderColor,
});

/**
 * A hook for loading an image from oseh. This hook will load the playlist
 * for the given uid, and then select the best image to display based on
 * the displayWidth and displayHeight props as well as device characteristics,
 * such as DPI. This will then download the image, and if necessary, crop it
 * to the desired size before returning a URL to the corresponding blob via
 * the states localUrl property.
 *
 * @param props The props for the image to load; props do not need to be memoized.
 *   To disable loading, set the uid to null.
 * @param handler The handler to use for requests. This allows the resources
 *   required for generating images to be reused, i.e., the playlist or the
 *   original image or even the cropped image.
 * @returns The state of the image which can be used by OsehImageFromState
 */
export const useOsehImageState = (
  props: OsehImageProps,
  handler: OsehImageStateRequestHandler
): OsehImageState => {
  const [state, setState] = useState<OsehImageState>(() => createLoadingState(props));

  useEffect(() => {
    const cpProps: OsehImageProps = {
      uid: props.uid,
      jwt: props.jwt,
      displayWidth: props.displayWidth,
      displayHeight: props.displayHeight,
      alt: props.alt,
      isPublic: props.isPublic,
      placeholderColor: props.placeholderColor,
    };

    if (cpProps.uid === null) {
      setState((s) => {
        if (s.localUrl !== null) {
          return createLoadingState(cpProps);
        }
        return s;
      });
      return;
    }
    const stateRef = handler.request(cpProps as OsehImagePropsLoadable);
    stateRef.stateChanged.add((s) => {
      setState(s);
    });
    setState(stateRef.state);
    return () => {
      stateRef.release();
    };
  }, [
    props.uid,
    props.jwt,
    props.displayWidth,
    props.displayHeight,
    props.alt,
    props.isPublic,
    props.placeholderColor,
    handler,
  ]);

  return state;
};
