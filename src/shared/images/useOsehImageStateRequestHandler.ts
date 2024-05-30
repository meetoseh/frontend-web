import { useMemo } from 'react';
import {
  Callbacks,
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { DisplaySize, OsehImagePropsLoadable } from './OsehImageProps';
import { OsehImageState, areOsehImageStatesEqual } from './OsehImageState';
import { createImagePrivatePlaylistRequestHandler } from './createImagePrivatePlaylistRequestHandler';
import { createImagePublicPlaylistRequestHandler } from './createImagePublicPlaylistRequestHandler';
import { createImageDataRequestHandler } from './createImageDataRequestHandler';
import { createImageCropRequestHandler } from './createImageCropRequestHandler';
import { OsehImageExportCropped } from './OsehImageExportCropped';
import { RequestHandler, RequestResult } from '../requests/RequestHandler';
import { OsehImageExport } from './OsehImageExport';
import { OsehImageExportCroppedRef } from './OsehImageExportCroppedRef';
import { OsehImageExportRef } from './OsehImageExportRef';
import { OsehImageRef } from './OsehImageRef';
import { PlaylistItem, PlaylistWithJWT, selectBestItemUsingPixelRatio } from './Playlist';
import { OsehPublicImageRef } from './OsehPublicImageRef';
import { setVWC } from '../lib/setVWC';
import { USES_WEBP } from './usesWebp';
import {
  convertLogicalHeightToPhysicalHeight,
  convertLogicalWidthToPhysicalWidth,
  largestPhysicalPerLogical,
  xAxisPhysicalPerLogical,
  yAxisPhysicalPerLogical,
} from './DisplayRatioHelper';
import { USES_SVG } from './usesSvg';
import { createChainedRequest } from '../requests/createChainedRequest';

/**
 * Describes a manually ref-counted reference to a given OsehImageState. While
 * the reference is held, the necessary server responses for generating the
 * state (e.g., the playlist response and the original image) are kept in an
 * accessible data store such that they can be reused if the same image is
 * requested again.
 *
 * Once the callee that requested the image state no longer needs it, they
 * should call the release() method to indicate that they no longer need the
 * image state. Once all references to the image state have been released, the
 * resources used to generate the image state are moved to a cache with a
 * limited size, in case they are needed again in the future.
 *
 * This object type is mutated by changing the state value and then calling
 * the stateChanged callbacks. Hence, it's not suitable for use as a hook
 * dependency. It can be converted into a hook dependency using the
 * `useOsehImageFromRequestedState` hook.
 */
export type OsehImageRequestedState = {
  /**
   * The current value of the state. Mutated only by the
   * `useOsehImageFromRequestedState` hook.
   */
  state: OsehImageState;
  /**
   * The actual requested display size. If the caller does not specify
   * one of the dimensions, meaning they want to consider the available
   * aspect ratios in the decision, then this will differ from the state
   * displayWidth and displayHeight.
   *
   * Initially, the state displayWidth and displayHeight will be square
   * with the value of the other dimension, until the playlist is available.
   */
  displaySize: DisplaySize;
  /**
   * The callbacks invoked with the new state value whenever the state
   * value changes. Called only by the `useOsehImageFromRequestedState`
   */
  stateChanged: Callbacks<undefined>;
  /**
   * Releases the reference to the image state. Once all references to
   * the image state have been released, the resources used to generate
   * the image state are moved to a cache with a limited size, in case
   * they are needed again in the future.
   */
  release: () => void;
};

/**
 * Describes an object capable of loading images using a manually ref-counted
 * strategy.
 *
 * To get an image state, use `request`. Once you no longer need that image
 * state, call `release` on the returned object.
 */
export type OsehImageStateRequestHandler = {
  request: (props: OsehImagePropsLoadable) => OsehImageRequestedState;
};

/**
 * Provides a simple interface for fetching image states using a manual
 * ref-counting strategy, such that images are reused while they are
 * still in use.
 *
 * When they are no longer in use, we move the corresponding resources
 * to a cache with a limited size, in case they are used again in the
 * future.
 */
export const useOsehImageStateRequestHandler = ({
  logging = 'none',
  cacheSize = 16,
}: {
  logging?: 'none' | 'buffer' | 'direct';
  cacheSize?: number;
}): OsehImageStateRequestHandler => {
  const privatePlaylistHandler = useWritableValueWithCallbacks(() =>
    createImagePrivatePlaylistRequestHandler({ logging, maxStale: cacheSize })
  );
  const publicPlaylistHandler = useWritableValueWithCallbacks(() =>
    createImagePublicPlaylistRequestHandler({ logging, maxStale: cacheSize })
  );
  const imageDataHandler = useWritableValueWithCallbacks(() =>
    createImageDataRequestHandler({ logging, maxStale: cacheSize })
  );
  const imageCropHandler = useWritableValueWithCallbacks(() =>
    createImageCropRequestHandler({ logging, maxStale: cacheSize })
  );

  return useMemo(
    () =>
      createOsehImageStateRequestHandler({
        privatePlaylistHandler: privatePlaylistHandler.get(),
        publicPlaylistHandler: publicPlaylistHandler.get(),
        imageDataHandler: imageDataHandler.get(),
        imageCropHandler: imageCropHandler.get(),
      }),
    [privatePlaylistHandler, publicPlaylistHandler, imageDataHandler, imageCropHandler]
  );
};

/**
 * Uses the given request handlers to create a new OsehImageStateRequestHandler.
 * This is just one way of managing the glue code to start with a image uid and
 * go straight to the image data.
 */
export const createOsehImageStateRequestHandler = ({
  privatePlaylistHandler,
  publicPlaylistHandler,
  imageDataHandler,
  imageCropHandler,
}: {
  privatePlaylistHandler: RequestHandler<{ uid: string }, OsehImageRef, PlaylistWithJWT>;
  publicPlaylistHandler: RequestHandler<{ uid: string }, OsehPublicImageRef, PlaylistWithJWT>;
  imageDataHandler: RequestHandler<{ item: { uid: string } }, OsehImageExportRef, OsehImageExport>;
  imageCropHandler: RequestHandler<
    { export: { item: { uid: string } }; cropTo: DisplaySize },
    OsehImageExportCroppedRef,
    OsehImageExportCropped
  >;
}): OsehImageStateRequestHandler => {
  const request = (props: OsehImagePropsLoadable): OsehImageRequestedState => {
    // TODO: changing the JWT should not cause a release; we need to handle
    // that seamlessly
    const released = createWritableValueWithCallbacks(false);
    const release = () => {
      setVWC(released, true);
      released.callbacks.clear();
    };

    const stateChanged = new Callbacks<undefined>();
    const result: OsehImageRequestedState = {
      state: makeLoading(props),
      stateChanged,
      displaySize: {
        width: props.displayWidth,
        height: props.displayHeight,
      } as unknown as DisplaySize,
      release,
    };

    manageRequest(
      props,
      result,
      privatePlaylistHandler,
      publicPlaylistHandler,
      imageDataHandler,
      imageCropHandler,
      released
    );

    return result;
  };

  return { request };
};

const makeLoading = (props: OsehImagePropsLoadable, item?: PlaylistItem): OsehImageState => {
  let displayWidth: number;
  let displayHeight: number;

  if (props.displayWidth === null) {
    displayHeight = props.displayHeight;
    if (item !== undefined) {
      displayWidth =
        Math.ceil(
          convertLogicalWidthToPhysicalWidth(props.displayHeight * (item.width / item.height))
        ) / xAxisPhysicalPerLogical;
    } else {
      displayWidth = props.displayHeight;
    }
  } else if (props.displayHeight === null) {
    displayWidth = props.displayWidth;
    if (item !== undefined) {
      displayHeight =
        Math.ceil(
          convertLogicalHeightToPhysicalHeight(props.displayWidth * (item.height / item.width))
        ) / yAxisPhysicalPerLogical;
    } else {
      displayHeight = props.displayWidth;
    }
  } else {
    displayWidth = props.displayWidth;
    displayHeight = props.displayHeight;
  }

  return {
    localUrl: null,
    thumbhash: null,
    displayWidth,
    displayHeight,
    alt: props.alt,
    loading: true,
    placeholderColor: props.placeholderColor,
  };
};

const manageRequest = async (
  props: OsehImagePropsLoadable,
  result: OsehImageRequestedState,
  privatePlaylistHandler: RequestHandler<{ uid: string }, OsehImageRef, PlaylistWithJWT>,
  publicPlaylistHandler: RequestHandler<{ uid: string }, OsehPublicImageRef, PlaylistWithJWT>,
  imageDataHandler: RequestHandler<{ item: { uid: string } }, OsehImageExportRef, OsehImageExport>,
  imageCropHandler: RequestHandler<
    { export: { item: { uid: string } }; cropTo: DisplaySize },
    OsehImageExportCroppedRef,
    OsehImageExportCropped
  >,
  released: ValueWithCallbacks<boolean>
) => {
  const usesWebp = await USES_WEBP;
  const usesSvg = await USES_SVG;

  const boundGetPlaylist = () => getPlaylist(props, privatePlaylistHandler, publicPlaylistHandler);

  if (props.thumbhashOnly) {
    const playlist = boundGetPlaylist();
    const onPlaylistDataChanged = () => {
      if (released.get()) {
        return;
      }

      const data = playlist.data.get();
      if (data.type !== 'success') {
        result.state = makeLoading(props);
        result.stateChanged.call(undefined);
        return;
      }

      const item = getExportRef(props, data.data, usesWebp, usesSvg);
      const newState = makeLoading(props, item.item);
      newState.thumbhash = item.item.thumbhash;
      if (!areOsehImageStatesEqual(result.state, newState)) {
        result.state = newState;
        result.stateChanged.call(undefined);
      }
    };
    playlist.data.callbacks.add(onPlaylistDataChanged);

    const handleRelease = () => {
      released.callbacks.remove(handleRelease);
      playlist.data.callbacks.remove(onPlaylistDataChanged);
      playlist.release();
    };
    released.callbacks.add(handleRelease);
    if (released.get()) {
      handleRelease();
    }
    return;
  }

  const exportRef = createWritableValueWithCallbacks<OsehImageExportRef | null>(null);
  const boundGetExport = () =>
    getExport(props, boundGetPlaylist, imageDataHandler, usesWebp, usesSvg, (ref) =>
      setVWC(exportRef, ref, Object.is)
    );
  const boundGetExportCropped = () => getExportCropped(props, boundGetExport, imageCropHandler);

  const onExportRefChanged = () => {
    const ref = exportRef.get();
    if (ref === null) {
      return;
    }

    if (result.state.thumbhash !== ref.item.thumbhash) {
      result.state.thumbhash = ref.item.thumbhash;
      result.stateChanged.call(undefined);
    }
  };
  exportRef.callbacks.add(onExportRefChanged);

  const cropped = boundGetExportCropped();
  const onCroppedDataChanged = () => {
    const croppedData = cropped.data.get();
    const ref = exportRef.get();
    const thumbhash = ref === null ? null : ref.item.thumbhash;
    if (croppedData.type !== 'success') {
      result.state = makeLoading(props, ref?.item);
      result.state.thumbhash = thumbhash;
      result.stateChanged.call(undefined);
      return;
    }

    const data = croppedData.data;
    result.state = {
      localUrl: data.croppedUrl,
      thumbhash,
      displayWidth: data.croppedToDisplay.displayWidth,
      displayHeight: data.croppedToDisplay.displayHeight,
      alt: props.alt,
      loading: false,
    };
    result.stateChanged.call(undefined);
  };
  cropped.data.callbacks.add(onCroppedDataChanged);

  const handleRelease = () => {
    released.callbacks.remove(handleRelease);
    exportRef.callbacks.remove(onExportRefChanged);
    cropped.data.callbacks.remove(onCroppedDataChanged);
    cropped.release();
  };
  released.callbacks.add(handleRelease);
  if (released.get()) {
    handleRelease();
  }
};

const getPlaylist = (
  props: OsehImagePropsLoadable,
  privatePlaylistHandler: RequestHandler<{ uid: string }, OsehImageRef, PlaylistWithJWT>,
  publicPlaylistHandler: RequestHandler<{ uid: string }, OsehPublicImageRef, PlaylistWithJWT>
): RequestResult<PlaylistWithJWT> => {
  // TODO -> add refreshProps argument
  return props.isPublic
    ? publicPlaylistHandler.request({
        ref: { uid: props.uid, jwt: null },
        refreshRef: () => {
          throw new Error('not implemented yet');
        },
      })
    : privatePlaylistHandler.request({
        ref: { uid: props.uid, jwt: props.jwt! },
        refreshRef: () => {
          throw new Error('not implemented yet');
        },
      });
};

const getExport = (
  props: OsehImagePropsLoadable,
  getPlaylist: () => RequestResult<PlaylistWithJWT>,
  imageDataHandler: RequestHandler<{ item: { uid: string } }, OsehImageExportRef, OsehImageExport>,
  usesWebp: boolean,
  usesSvg: boolean,
  onExportRefChanged: (ref: OsehImageExportRef | null) => void
): RequestResult<OsehImageExport> => {
  return createChainedRequest(
    getPlaylist,
    imageDataHandler,
    {
      sync: (playlist) => getExportRef(props, playlist, usesWebp, usesSvg),
      async: undefined,
      cancelable: undefined,
    },
    {
      onRefChanged: onExportRefChanged,
    }
  );
};

const getExportCropped = (
  props: OsehImagePropsLoadable,
  getExport: () => RequestResult<OsehImageExport>,
  imageCropHandler: RequestHandler<
    OsehImageExportCroppedRef,
    OsehImageExportCroppedRef,
    OsehImageExportCropped
  >
): RequestResult<OsehImageExportCropped> => {
  return createChainedRequest(getExport, imageCropHandler, {
    sync: (exp) => ({
      export: exp,
      cropTo: {
        displayWidth: props.displayWidth,
        displayHeight: props.displayHeight,
      } as DisplaySize,
    }),
    async: undefined,
    cancelable: undefined,
  });
};

const getExportRef = (
  props: OsehImagePropsLoadable,
  playlist: PlaylistWithJWT,
  usesWebp: boolean,
  usesSvg: boolean
): OsehImageExportRef => {
  const bestItem = selectBestItemUsingPixelRatio({
    playlist: playlist.playlist,
    usesWebp,
    usesSvg,
    logical:
      props.displayWidth === null
        ? {
            width: null,
            height: props.displayHeight,
            compareAspectRatios: props.compareAspectRatio,
          }
        : props.displayHeight === null
        ? {
            width: props.displayWidth,
            height: null,
            compareAspectRatios: props.compareAspectRatio,
          }
        : {
            width: props.displayWidth,
            height: props.displayHeight,
          },
    preferredPixelRatio: largestPhysicalPerLogical,
  });
  return {
    imageFile: { uid: props.uid, jwt: playlist.jwt },
    item: bestItem.item,
  };
};
