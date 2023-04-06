import { MutableRefObject, ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { convertUsingKeymap, CrudFetcherKeyMap } from '../admin/crud/CrudFetcher';
import { HTTP_API_URL } from './ApiConstants';
import { Callbacks } from './lib/Callbacks';
import { CancelablePromise } from './lib/CancelablePromise';
import { isJWTExpired } from './lib/getJwtExpiration';
import { LeastRecentlyUsedCache } from './lib/LeastRecentlyUsedCache';
import { removeUnmatchedKeysFromMap } from './lib/removeUnmatchedKeys';

/**
 * Describes the minimum information required to reference a specific
 * image.
 */
export type OsehImageRef = {
  /** The uid of the image file */
  uid: string;
  /** A JWT which provides access to the image file */
  jwt: string;
};

export type OsehImageProps = {
  /**
   * The uid of the oseh image file. If null, no image is loaded until
   * the uid is set.
   */
  uid: string | null;

  /**
   * The JWT which provides access to the image file. May only be null if not is_public
   */
  jwt: string | null;

  /**
   * The width we want to display the image at. The URL will be selected based on this.
   */
  displayWidth: number;

  /**
   * The height we want to display the image at. The URL will be selected based on this.
   */
  displayHeight: number;

  /**
   * The alt text for the image
   */
  alt: string;

  /**
   * If set and true, the jwt is ignored and we request this as a public file instead.
   */
  isPublic?: boolean;

  /**
   * If provided, this will be called whenever we start or finish loading
   * the image. This can be used to display a splash screen while the image
   * is loading.
   *
   * @param loading True if we're loading, false otherwise
   * @param uid The uid of the image we're loading, or null if we don't know yet
   */
  setLoading?: ((this: void, loading: boolean, uid: string | null) => void) | null;

  /**
   * If specified, used as the background color for the placeholder while the image
   * is loading
   */
  placeholderColor?: string;
};

/**
 * An item within a playlist
 */
type PlaylistItem = {
  /**
   * URL where the item can be accessed
   */
  url: string;
  /**
   * The format of the item, e.g., 'jpeg'
   */
  format: string;
  /**
   * The width of the item in pixels
   */
  width: number;
  /**
   * The height of the item in pixels
   */
  height: number;
  /**
   * The size of the item in bytes
   */
  sizeBytes: number;
};

const playlistItemKeymap: CrudFetcherKeyMap<PlaylistItem> = {
  size_bytes: 'sizeBytes',
};

const playlistItemsEqual = (a: PlaylistItem | null, b: PlaylistItem | null): boolean => {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  return (
    a.url === b.url &&
    a.format === b.format &&
    a.width === b.width &&
    a.height === b.height &&
    a.sizeBytes === b.sizeBytes
  );
};

type PlaylistItemWithJWTAndCropSize = {
  item: PlaylistItem;
  jwt: string;
  cropTo?: { width: number; height: number };
};

/**
 * Determines if two crop sizes are equal. If either is undefined, they are
 * considered equal if the other is undefined.
 *
 * @param a The first crop size
 * @param b The second crop size
 * @returns True if the crop sizes are equal, false otherwise
 */
const cropToEqual = (
  a?: { width: number; height: number },
  b?: { width: number; height: number }
): boolean => {
  if (a === b) {
    return true;
  }

  if (a === undefined || b === undefined) {
    return false;
  }

  return a.width === b.width && a.height === b.height;
};

type Playlist = {
  /**
   * The uid of the image file this playlist is for, so we don't refetch the image
   * just because the jwt changed
   */
  uid: string;

  /**
   * The items in the playlist, broken out by format, where
   * the lists are sorted by size, ascending.
   */
  items: { [format: string]: PlaylistItem[] };
};

const playlistKeymap: CrudFetcherKeyMap<Playlist> = {
  items: (_, v: { [format: string]: any[] }) => ({
    key: 'items',
    value: Object.fromEntries(
      Object.entries(v).map(([key, val]) => [
        key,
        val.map((v) => convertUsingKeymap(v, playlistItemKeymap)),
      ])
    ),
  }),
};

const playlistsEqual = (a: Playlist | null, b: Playlist | null): boolean => {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  if (a.uid !== b.uid) {
    return false;
  }

  const aKeys = Object.keys(a.items);
  const bKeys = Object.keys(b.items);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (!bKeys.includes(key)) {
      return false;
    }

    const aItems = a.items[key];
    const bItems = b.items[key];

    if (aItems.length !== bItems.length) {
      return false;
    }

    for (let i = 0; i < aItems.length; i++) {
      if (!playlistItemsEqual(aItems[i], bItems[i])) {
        return false;
      }
    }
  }

  return true;
};

type PlaylistWithJWT = { playlist: Playlist; jwt: string };

/**
 * If webp support is available
 */
const USES_WEBP: Promise<boolean> = (async () => {
  var canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  if (!!(canvas.getContext && canvas.getContext('2d'))) {
    if (canvas.toDataURL('image/webp').startsWith('data:image/webp')) {
      return true;
    }

    return new Promise((resolve) => {
      const testImages: string[] = [
        'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
        'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
        'UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==',
        'UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA',
      ];

      let successCounter = 0;
      let failureCounter = 0;
      testImages.forEach((testImage) => {
        const img = new Image();
        img.onload = () => {
          if (img.width > 0 && img.height > 0) {
            successCounter++;
            if (successCounter === testImages.length) {
              resolve(true);
            }
          } else {
            failureCounter++;
            if (failureCounter === 1) {
              resolve(false);
            }
          }
        };
        img.onerror = () => {
          failureCounter++;
          if (failureCounter === 1) {
            resolve(false);
          }
        };
        img.src = 'data:image/webp;base64,' + testImage;
      });
    });
  }

  return false;
})();

/**
 * The required state information to display an oseh image. Useful when you want
 * to use a single image in multiple places, as the standard OsehImage component
 * will refetch the image state every time
 */
export type OsehImageState = {
  /**
   * The local url where the image can be accessed
   */
  localUrl: string | null;

  /**
   * The width we want to display the image at. The URL will be selected based on this.
   */
  displayWidth: number;

  /**
   * The height we want to display the image at. The URL will be selected based on this.
   */
  displayHeight: number;

  /**
   * The alt text for the image
   */
  alt: string;

  /**
   * True if the image is loading, false otherwise
   */
  loading: boolean;

  /**
   * If a specific color should be used for the placeholder while loading,
   * this is the color. If not, this is null.
   */
  placeholderColor?: string;
};

/**
 * The information we need about an item that we have successfully
 * downloaded.
 */
type DownloadedItem = {
  /**
   * A URI where the resource can be accessed locally (either memory
   * or disk)
   */
  localUrl: string;

  /**
   * If the local version is actually a cropped version of the remote version,
   * this is the local url where the original remote version can be accessed
   * in case we need to crop it differently.
   */
  originalLocalUrl: string;

  /**
   * The URI we fetched the resource from, primarily for avoiding
   * refetching the same resource
   */
  remoteUrl: string;

  /**
   * If the local version is actually a cropped version of the remote version,
   * this is the size we cropped the remote version to. We always crop to the
   * center and this is never greater than the remote version on either axis.
   */
  croppedTo?: { width: number; height: number };
};

const downloadedItemsEqual = (a: DownloadedItem | null, b: DownloadedItem | null): boolean => {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  return (
    a.localUrl === b.localUrl &&
    a.originalLocalUrl === b.originalLocalUrl &&
    a.remoteUrl === b.remoteUrl &&
    (a.croppedTo === b.croppedTo ||
      (a.croppedTo !== undefined &&
        b.croppedTo !== undefined &&
        a.croppedTo.width === b.croppedTo.width &&
        a.croppedTo.height === b.croppedTo.height))
  );
};

/**
 * Gets how many useful pixels there are if you have an image
 * of the given width and height, and you want to display it
 * at the given display width and height.
 *
 * For example, if you have an image of 1000x1000 pixels, and
 * you want an image of 100x100 pixels, then there are 100x100
 * useful pixels on a cover crop, as you will take the center
 * 100x100 pixels of the image.
 *
 * If you have an image of 1000x1000 pixels, and you want an
 * image of 500x2000 pixels, there are 500x1000 useful pixels
 *
 * This is one part of the calculation of determining which
 * image to use.
 *
 * @param have The width and height of the image you are considering
 * @param want The width and height of the image you want to display
 */
const getUsefulArea = (
  have: { width: number; height: number },
  want: { width: number; height: number }
) => {
  const effectiveHave = {
    width: Math.min(have.width, want.width),
    height: Math.min(have.height, want.height),
  };

  return effectiveHave.width * effectiveHave.height;
};

/**
 * Gets how many useless pixels there are if you have an image
 * of the given width and height, and you want to display it
 * at the given display width and height.
 *
 * When thinking of this calculation, it's helpful to imagine
 * we are cropping to the the top-left rather than the center;
 * one can be easily convinced this doesn't effect the answer,
 * since we use the same area either way.
 *
 * For example, if you have an image of 1000x1000 pixels, and
 * you want an image of 100x100 pixels, then there are 3 rectangles
 * which are useless: 900x100 on the right, 900x900 square
 * bottom right, and 100x900 below. Thus the total useless area is
 * (900x100) + (900x900) + (100x900) = 990,000 pixels. This is the
 * same as subtracting the useful area: 1000x1000 - 100x100
 *
 * If you have an image of 200x200 and want 300x100, then the useless
 * area is below: 200x100 = 20,000 pixels. Alternatively, it's the
 * (200*200) total pixels - (200*100) useful pixels = 20,000 pixels.
 *
 * @param have The width and height of the image you are considering
 * @param want The width and height of the image you want to display
 */
const getUselessArea = (
  have: { width: number; height: number },
  want: { width: number; height: number }
) => {
  return have.width * have.height - getUsefulArea(have, want);
};

/**
 * Compares available images to determine which is the best when
 * you want to display an image of the given width and height.
 *
 * @param want The width and height of the image you want to display
 * @param a The first option to compare
 * @param b The second option to compare
 * @return negative if a is better, positive if b is better, 0 if they are equal
 */
const compareSizes = (
  want: { width: number; height: number },
  a: { width: number; height: number },
  b: { width: number; height: number }
): number => {
  // first by useful area (larger is better), then by
  // useless area (smaller is better)
  const usefulAreaA = getUsefulArea(a, want);
  const usefulAreaB = getUsefulArea(b, want);
  if (usefulAreaA !== usefulAreaB) {
    return usefulAreaB - usefulAreaA;
  }

  const uselessAreaA = getUselessArea(a, want);
  const uselessAreaB = getUselessArea(b, want);
  return uselessAreaA - uselessAreaB;
};

/**
 * Fetches the playlist information for a given private playlist. Returns
 * a rejected promise if there is a network error or the server returns
 * a non-200 status code.
 *
 * @param uid The uid of the playlist to fetch
 * @param jwt The JWT to use to authenticate the request
 * @returns The playlist information
 */
const fetchPrivatePlaylist = async (uid: string, jwt: string): Promise<Playlist> => {
  const response = await fetch(`${HTTP_API_URL}/api/1/image_files/playlist/${uid}`, {
    method: 'GET',
    headers: { authorization: `bearer ${jwt}` },
  });

  if (!response.ok) {
    throw response;
  }

  const data = await response.json();
  return convertUsingKeymap(data, playlistKeymap);
};

/**
 * Fetches the playlist information for a given public playlist. Returns
 * a rejected promise if there is a network error or the server returns
 * a non-200 status code.
 *
 * Public playlists still require a jwt to access the individual exports,
 * but the response includes the jwt to use in the header. Thus, this
 * also returns the jwt to use for fetching the individual exports.
 *
 * @param uid The uid of the playlist to fetch
 * @returns The playlist information and the jwt to use to fetch the individual exports
 */
const fetchPublicPlaylist = async (uid: string): Promise<{ playlist: Playlist; jwt: string }> => {
  const response = await fetch(`${HTTP_API_URL}/api/1/image_files/playlist/${uid}?public=1`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw response;
  }

  const jwt = response.headers.get('x-image-file-jwt');
  if (jwt === null) {
    throw new Error('Public playlist response did not include JWT in x-image-file-jwt header');
  }

  const data = await response.json();
  const playlist = convertUsingKeymap(data, playlistKeymap);
  return { playlist, jwt };
};

/**
 * Selects the format available in the given playlist by preference
 * based on the actual width and height we want to display the final
 * exported image at.
 *
 * @param playlist The playlist to select from
 * @param usesWebp Whether the device supports webp
 * @param want The width and height of the image we want to display
 * @returns The format to use
 */
function selectFormat<T extends Playlist>(
  playlist: T,
  usesWebp: boolean,
  want: { width: number; height: number }
): string & keyof T['items'] {
  const area = want.width * want.height;

  if (usesWebp && playlist.items.webp) {
    return 'webp';
  }

  if (area <= 200 * 200 && playlist.items.png) {
    return 'png';
  }

  return 'jpeg';
}

/**
 * Selects the best item within the given list of options, given
 * that we want to render it at the given width and height.
 *
 * @param items The list of items to choose from, must be non-empty
 */
const selectBestItemFromItems = (
  items: PlaylistItem[],
  want: { width: number; height: number }
): PlaylistItem => {
  if (items.length === 0) {
    throw new Error('Cannot select best item from empty list');
  }

  let best = items[0];
  for (let i = 1; i < items.length; i++) {
    if (compareSizes(want, items[i], best) < 0) {
      best = items[i];
    }
  }
  return best;
};

/**
 * Selects the best item from the given playlist, given that we want
 * to render it at the given width and height and if the device supports
 * webp.
 *
 * @param playlist The playlist to select from
 * @param usesWebp Whether the device supports webp
 * @param want The width and height of the image we want to display
 * @returns The best item to use
 */
const selectBestItem = (
  playlist: Playlist,
  usesWebp: boolean,
  want: { width: number; height: number }
): PlaylistItem => {
  const format = selectFormat(playlist, usesWebp, want);
  return selectBestItemFromItems(playlist.items[format], want);
};

/**
 * Determines the best size to use for the given playlist when we want
 * to render an image at the given logical size and pixel ratio,
 * then uses that to determine the best item to use. This is a pixel-ratio
 * aware variant of selectBestItem, as it's often better to downgrade pixel
 * ratios rather than using an image which is too small.
 */
const selectBestItemUsingPixelRatio = ({
  playlist,
  usesWebp,
  logical,
  preferredPixelRatio,
}: {
  playlist: Playlist;
  usesWebp: boolean;
  logical: { width: number; height: number };
  preferredPixelRatio: number;
}): { item: PlaylistItem; cropTo?: { width: number; height: number } } => {
  let pixelRatio = preferredPixelRatio;
  while (true) {
    const want = { width: logical.width * pixelRatio, height: logical.height * pixelRatio };
    const item = selectBestItem(playlist, usesWebp, want);

    const satisfactorilyLarge = item.width >= want.width && item.height >= want.height;
    if (pixelRatio === preferredPixelRatio && satisfactorilyLarge) {
      return { item };
    }
    if (satisfactorilyLarge) {
      return {
        item,
        cropTo: { width: want.width, height: want.height },
      };
    }
    if (pixelRatio <= 1) {
      return { item };
    }
    pixelRatio = Math.max(1, pixelRatio - 1);
  }
};

const cropImageUnsafe = async (
  src: string,
  cropTo: { width: number; height: number }
): Promise<string> => {
  const usesWebp = await USES_WEBP;
  const format = usesWebp ? 'image/webp' : 'image/png';
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropTo.width;
      canvas.height = cropTo.height;
      const ctx = canvas.getContext('2d');
      if (ctx === null) {
        reject(new Error('Could not get 2d context from canvas'));
        return;
      }
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      const leftCrop = Math.floor((imgWidth - cropTo.width) / 2);
      const topCrop = Math.floor((imgHeight - cropTo.height) / 2);

      ctx.drawImage(
        img,
        leftCrop,
        topCrop,
        cropTo.width,
        cropTo.height,
        0,
        0,
        cropTo.width,
        cropTo.height
      );
      canvas.toBlob(
        (blob) => {
          if (blob === null) {
            reject(new Error('Could not convert canvas to blob'));
            return;
          }
          resolve(URL.createObjectURL(blob));
        },
        format,
        1
      );
    };
    img.src = src;
  });
};

/**
 * Crops the image at the given url to the given size, returning
 * a promise which resolves to a url where the cropped image can
 * be downloaded.
 *
 * Unlike cropImageUnsafe, which shouldn't be used directly, if
 * something goes wrong this returns the original image url.
 */
const cropImage = async (
  src: string,
  cropTo: { width: number; height: number }
): Promise<string> => {
  try {
    return await cropImageUnsafe(src, cropTo);
  } catch (e) {
    console.error('Error cropping image', e);
    return src;
  }
};

/**
 * Downloads the given playlist item. Returns a rejected promise if
 * there is a network error or the server returns a non-200 status code.
 *
 * @param item The item to download
 * @param jwt The JWT to use to authenticate the request
 * @param opts.cropTo If specified, the downloaded image will be cropped to the given size.
 *   This is useful for when we are intentionally rendering an image at a lowered pixel ratio,
 *   as by default most browsers will instead stretch the image (which looks terrible).
 * @returns The downloaded item
 */
const downloadItem = async (
  item: PlaylistItem,
  jwt: string,
  opts?: { cropTo?: { width: number; height: number } }
): Promise<DownloadedItem> => {
  const response = await fetch(item.url, {
    headers: { Authorization: `bearer ${jwt}` },
  });
  if (!response.ok) {
    throw response;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  if (opts !== undefined && opts.cropTo !== undefined) {
    const cropped = await cropImage(url, opts.cropTo);
    return {
      remoteUrl: item.url,
      localUrl: cropped,
      originalLocalUrl: url,
      croppedTo: opts.cropTo,
    };
  }

  return {
    remoteUrl: item.url,
    localUrl: url,
    originalLocalUrl: url,
  };
};

/**
 * Creates a component which renders an Image for the given image file on oseh.
 * Image files from oseh come from a playlist with various image formats and
 * resolutions that are available, and this component will select the best
 * image to display based on the displayWidth and displayHeight props as well
 * as device characteristics, such as DPI.
 *
 * This is just a convenience component for useOsehImageState + OsehImageFromState
 *
 * @returns The element to render
 */
export const OsehImage = (props: OsehImageProps): ReactElement => {
  const memodProps = useMemo(
    () => ({
      uid: props.uid,
      jwt: props.jwt,
      displayWidth: props.displayWidth,
      displayHeight: props.displayHeight,
      alt: props.alt,
      isPublic: props.isPublic,
      setLoading: props.setLoading,
      placeholderColor: props.placeholderColor,
    }),
    [
      props.uid,
      props.jwt,
      props.displayWidth,
      props.displayHeight,
      props.alt,
      props.isPublic,
      props.setLoading,
      props.placeholderColor,
    ]
  );

  const state = useOsehImageState(memodProps);
  return <OsehImageFromState {...state} />;
};

/**
 * Creates a component which renders an image whose state has already been loaded
 * as if by useOsehImageState.
 *
 * @returns The element to render
 */
export const OsehImageFromState = ({
  localUrl,
  displayWidth,
  displayHeight,
  alt,
  placeholderColor,
}: OsehImageState): ReactElement => {
  if (localUrl === null && placeholderColor !== undefined) {
    return (
      <div
        style={{ width: displayWidth, height: displayHeight, backgroundColor: placeholderColor }}
      />
    );
  }

  return (
    <img
      src={localUrl ?? require('./placeholder.png')}
      style={{ width: displayWidth, height: displayHeight, objectFit: 'cover' }}
      alt={alt}
    />
  );
};

/**
 * A hook for loading an image from oseh. This hook will load the playlist
 * for the given uid, and then select the best image to display based on
 * the displayWidth and displayHeight props as well as device characteristics,
 * such as DPI. This will then download the image, but will not decode it,
 * before setting loading to false and setting the localUrl to the downloaded
 * image blob.
 *
 * @returns The state of the image which can be used by OsehImageFromState
 */
export const useOsehImageState = (props: OsehImageProps): OsehImageState => {
  const memodProps = useMemo(() => [props], [props]);
  return useOsehImageStates(memodProps)[0];
};

/**
 * A variant of useOsehImageState that can be used to load multiple images
 * in a single effect. This is useful when the number of images being loaded
 * may change, but the images still need to be reused. This will only reload
 * the images that actually change.
 *
 * Returns the image states in the order of the items array. Items with no
 * uid will be stuck loading.
 */
export const useOsehImageStates = (images: OsehImageProps[]): OsehImageState[] => {
  const [playlists, setPlaylists] = useState<Map<string, PlaylistWithJWT>>(new Map());
  const [bestItems, setBestItems] = useState<Map<string, PlaylistItemWithJWTAndCropSize>>(
    new Map()
  );
  const [downloadedItems, setDownloadedItems] = useState<Map<string, DownloadedItem>>(new Map());

  const uidsToImages = useMemo(() => {
    const map: Map<string, OsehImageProps> = new Map();
    for (const img of images) {
      if (img.uid !== null) {
        map.set(img.uid, img);
      }
    }
    return map;
  }, [images]);

  useEffect(() => {
    let active = true;
    fetchPlaylists();
    return () => {
      active = false;
    };

    async function fetchPlaylist(
      props: OsehImageProps,
      old: PlaylistWithJWT | null
    ): Promise<PlaylistWithJWT | null> {
      if (props.uid === null) {
        return null;
      }

      if (old !== null && old.playlist.uid === props.uid) {
        return old;
      }

      if (props.isPublic) {
        return await fetchPublicPlaylist(props.uid);
      }

      if (props.jwt === null) {
        throw new Error('Cannot fetch private playlist without JWT');
      }

      return { playlist: await fetchPrivatePlaylist(props.uid, props.jwt), jwt: props.jwt };
    }

    async function fetchPlaylists() {
      const newPlaylists = removeUnmatchedKeysFromMap(playlists, uidsToImages);
      let madeChanges = newPlaylists.size !== playlists.size;

      const promises: Promise<void>[] = [];
      const uids: string[] = [];
      uidsToImages.forEach((props, uid) => {
        const old = newPlaylists.get(uid) ?? null;
        uids.push(uid);
        promises.push(
          fetchPlaylist(props, old).then((playlist) => {
            if (!active) {
              return;
            }

            if (playlist === null || old === null) {
              madeChanges ||= playlist !== old;
            } else {
              madeChanges ||=
                !playlistsEqual(playlist.playlist, old.playlist) || playlist.jwt !== old.jwt;
            }

            if (playlist === null) {
              newPlaylists.delete(uid);
            } else {
              newPlaylists.set(uid, playlist);
            }
          })
        );
      });

      const settled = await Promise.allSettled(promises);
      if (!active) {
        return;
      }

      settled.forEach((p, idx) => {
        if (p.status === 'rejected') {
          console.error('Failed to fetch playlist', uids[idx], p.reason);
          if (newPlaylists.has(uids[idx])) {
            newPlaylists.delete(uids[idx]);
            madeChanges = true;
          }
        }
      });

      if (madeChanges) {
        setPlaylists(newPlaylists);
      }
    }
  }, [uidsToImages, playlists]);

  useEffect(() => {
    let active = true;
    fetchBestItems();
    return () => {
      active = false;
    };

    async function fetchBestItems() {
      const usesWebp = await USES_WEBP;
      if (!active) {
        return;
      }

      const newBestItems = removeUnmatchedKeysFromMap(bestItems, playlists);
      let madeChanges = newBestItems.size !== bestItems.size;

      playlists.forEach((playlist, uid) => {
        const props = uidsToImages.get(uid) ?? null;
        if (props === null) {
          if (newBestItems.has(uid)) {
            newBestItems.delete(uid);
            madeChanges = true;
          }
          return;
        }

        const old = newBestItems.get(uid) ?? null;
        const bestItem = selectBestItemUsingPixelRatio({
          playlist: playlist.playlist,
          logical: { width: props.displayWidth, height: props.displayHeight },
          usesWebp,
          preferredPixelRatio: devicePixelRatio,
        });
        if (
          old === null ||
          old.jwt !== playlist.jwt ||
          !playlistItemsEqual(old.item, bestItem.item) ||
          !cropToEqual(old.cropTo, bestItem.cropTo)
        ) {
          newBestItems.set(uid, {
            item: bestItem.item,
            cropTo: bestItem.cropTo,
            jwt: playlist.jwt,
          });
          madeChanges = true;
        }
      });

      if (madeChanges) {
        setBestItems(newBestItems);
      }
    }
  }, [uidsToImages, playlists, bestItems]);

  useEffect(() => {
    let active = true;
    fetchDownloadedItems();
    return () => {
      active = false;
    };

    async function fetchDownloadedItem(
      item: PlaylistItemWithJWTAndCropSize,
      old: DownloadedItem | null
    ): Promise<DownloadedItem> {
      if (
        old !== null &&
        old.remoteUrl === item.item.url &&
        cropToEqual(old.croppedTo, item.cropTo)
      ) {
        return old;
      }

      if (old !== null && old.remoteUrl === item.item.url) {
        if (item.cropTo === undefined) {
          return {
            remoteUrl: item.item.url,
            localUrl: old.originalLocalUrl,
            originalLocalUrl: old.originalLocalUrl,
          };
        }
        const recropped = await cropImage(old.originalLocalUrl, item.cropTo);
        return {
          remoteUrl: item.item.url,
          localUrl: recropped,
          originalLocalUrl: old.originalLocalUrl,
          croppedTo: item.cropTo,
        };
      }

      return downloadItem(item.item, item.jwt, { cropTo: item.cropTo });
    }

    async function fetchDownloadedItems() {
      const newDownloadedItems = removeUnmatchedKeysFromMap(downloadedItems, bestItems);
      let madeChanges = newDownloadedItems.size !== downloadedItems.size;

      const promises: Promise<void>[] = [];
      const uids: string[] = [];
      bestItems.forEach((item, uid) => {
        const old = newDownloadedItems.get(uid) ?? null;
        uids.push(uid);
        promises.push(
          fetchDownloadedItem(item, old).then((downloadedItem) => {
            if (!active) {
              return;
            }

            madeChanges ||= !downloadedItemsEqual(downloadedItem, old);
            if (downloadedItem === null) {
              newDownloadedItems.delete(uid);
            } else {
              newDownloadedItems.set(uid, downloadedItem);
            }
          })
        );
      });

      const settled = await Promise.allSettled(promises);
      if (!active) {
        return;
      }

      settled.forEach((p, idx) => {
        if (p.status === 'rejected') {
          console.error('Failed to download item', uids[idx], p.reason);
          if (newDownloadedItems.has(uids[idx])) {
            newDownloadedItems.delete(uids[idx]);
            madeChanges = true;
          }
        }
      });

      if (madeChanges) {
        setDownloadedItems(newDownloadedItems);
      }
    }
  }, [bestItems, downloadedItems]);

  /**
   * Calls isLoading callback if set
   */
  useEffect(() => {
    images.forEach((img) => {
      if (img.setLoading === null || img.setLoading === undefined) {
        return;
      }

      if (img.uid === null) {
        img.setLoading(true, null);
        return;
      }

      const downloadedItem = downloadedItems.get(img.uid);
      if (
        downloadedItem === null ||
        downloadedItem === undefined ||
        downloadedItem.localUrl === null
      ) {
        img.setLoading(true, img.uid);
        return;
      }

      img.setLoading(false, img.uid);
    });
  }, [images, downloadedItems]);

  return useMemo(() => {
    return images.map((img) => {
      if (img.uid === null) {
        return {
          localUrl: null,
          alt: img.alt,
          displayWidth: img.displayWidth,
          displayHeight: img.displayHeight,
          loading: true,
          placeholderColor: img.placeholderColor,
        };
      }

      const downloadedItem = downloadedItems.get(img.uid);
      if (downloadedItem === null || downloadedItem === undefined) {
        return {
          localUrl: null,
          alt: img.alt,
          displayWidth: img.displayWidth,
          displayHeight: img.displayHeight,
          loading: true,
          placeholderColor: img.placeholderColor,
        };
      }

      const localUrl = downloadedItem.localUrl ?? null;

      return {
        localUrl: localUrl,
        alt: img.alt,
        displayWidth: img.displayWidth,
        displayHeight: img.displayHeight,
        loading: localUrl === null,
        placeholderColor: img.placeholderColor,
      };
    });
  }, [images, downloadedItems]);
};

export type OsehImageStateChangedEvent = {
  /**
   * The uid of the image that changed state.
   */
  uid: string;

  /**
   * The previous state of the image, if it previously had state,
   * otherwise null.
   */
  old: OsehImageState | null;

  /**
   * The current state of the image, null if it is no longer
   * being handled.
   */
  current: OsehImageState | null;
};

export type ImageStatesRefHandlingChangedEvent = {
  /**
   * The uid of the image that is now being handled differently.
   */
  uid: string;

  /**
   * The previous props of the image, if it previously had props,
   * otherwise null.
   */
  old: OsehImageProps | null;

  /**
   * The current props of the image, null if it is no longer
   * being handled.
   */
  current: OsehImageProps | null;
};

export type OsehImageStatesRef = {
  /**
   * The current state of the images. This should only be be changed by
   * the useOsehImageStatesRef hook. The key is the image uid.
   */
  state: MutableRefObject<Map<string, OsehImageState>>;

  /**
   * The function that is called by the useOsehImageStatesRef hook when any of the
   * images change state.
   */
  onStateChanged: MutableRefObject<Callbacks<OsehImageStateChangedEvent>>;

  /**
   * The images that the hook is trying to load. This is never changed by
   * the useOsehImageStatesRef hook, and whenever it is changed the
   * person changing it should also call onHandlingChanged.
   *
   * The key is the image uid.
   */
  handling: MutableRefObject<Map<string, OsehImageProps>>;

  /**
   * The function that must be called by those using the useOsehImageStatesRef hook
   * whenever they change the handling ref.
   */
  onHandlingChanged: MutableRefObject<Callbacks<ImageStatesRefHandlingChangedEvent>>;
};

type OsehImageStatesRefProps = {
  /**
   * If specified, a least-recently-used cache with this size will be used for
   * images which got loaded but are no longer used, such that if they are
   * added to the handling list before they have been evicted from the cache,
   * they will not need to be reloaded. This is useful for rapidly changing
   * lists of images, such as a carousel or series of profile pictures.
   *
   * Undefined by default, which means no cache will be used. Must be at least
   * 2 if specified.
   *
   * Note that multiple cache keys are used per image - a good rough estimate
   * is to have this 2x the number of images you want to cache.
   */
  cacheSize?: number;
};

/**
 * A variant of useOsehImageStates that does not trigger any react state changes,
 * instead returning a ref to the states and a ref to a callbacks list that can
 * be used to detect when the state changes.
 *
 * The cache is cleared if the cache size is changed.
 *
 * This cannot handle rendering the same image multiple times at different
 * resolutions - if that is necessary, multiple different calls to
 * useOsehImageStatesRef should be used (once per resolution), or this can be
 * updated to support it if for some reason we can't predict the resolutions in
 * advance (would involve making a more complicated key for the state)
 */
export const useOsehImageStatesRef = ({
  cacheSize,
}: OsehImageStatesRefProps): OsehImageStatesRef => {
  const state = useRef<Map<string, OsehImageState>>() as MutableRefObject<
    Map<string, OsehImageState>
  >;
  const onStateChanged = useRef<Callbacks<OsehImageStateChangedEvent>>() as MutableRefObject<
    Callbacks<OsehImageStateChangedEvent>
  >;
  const handling = useRef<Map<string, OsehImageProps>>() as MutableRefObject<
    Map<string, OsehImageProps>
  >;
  const onHandlingChanged = useRef<
    Callbacks<ImageStatesRefHandlingChangedEvent>
  >() as MutableRefObject<Callbacks<ImageStatesRefHandlingChangedEvent>>;

  if (state.current === undefined) {
    state.current = new Map();
  }

  if (onStateChanged.current === undefined) {
    onStateChanged.current = new Callbacks();
  }

  if (handling.current === undefined) {
    handling.current = new Map();
  }

  if (onHandlingChanged.current === undefined) {
    onHandlingChanged.current = new Callbacks();
  }

  useEffect(() => {
    let active = true;
    const cancelers = new Callbacks<undefined>();
    const handlingCancelers = new Map<string, Callbacks<ImageStatesRefHandlingChangedEvent>>();
    const cache =
      cacheSize === undefined
        ? undefined
        : new LeastRecentlyUsedCache<string, OsehImageState>(cacheSize);
    const unmount = () => {
      if (!active) {
        return;
      }

      active = false;
      cancelers.call(undefined);
      handlingCancelers.forEach((canceler, uid) => {
        canceler.call({
          uid,
          old: handling.current.get(uid) ?? null,
          current: null,
        });
      });
    };
    fetchImages();
    return unmount;

    async function fetchImages() {
      onHandlingChanged.current.add(handlingChanged);
      cancelers.add(() => {
        onHandlingChanged.current.remove(handlingChanged);
      });
    }

    async function handlingChanged(event: ImageStatesRefHandlingChangedEvent) {
      if (!active) {
        return;
      }

      if (event.old === null && event.current === null) {
        return;
      }

      const usesWebp = await USES_WEBP;

      if (event.old === null && event.current !== null) {
        const callbacks = new Callbacks<ImageStatesRefHandlingChangedEvent>();
        handlingCancelers.set(event.uid, callbacks);
        handleImage(event.current, callbacks, usesWebp);
        return;
      }

      if (event.old !== null && event.current !== null) {
        const callbacks = handlingCancelers.get(event.uid);
        if (callbacks === undefined) {
          return;
        }

        callbacks.call(event);
        return;
      }

      if (event.old !== null && event.current === null) {
        const callbacks = handlingCancelers.get(event.uid);
        if (callbacks === undefined) {
          return;
        }

        callbacks.call(event);
        handlingCancelers.delete(event.uid);
        return;
      }
    }

    async function handleImage(
      imageProps: OsehImageProps,
      callbacks: Callbacks<ImageStatesRefHandlingChangedEvent>,
      usesWebp: boolean
    ) {
      if (imageProps.uid === null) {
        throw new Error('Image uid must be specified');
      }

      const cacheKey = `${imageProps.uid}-${imageProps.displayWidth}-${imageProps.displayHeight}`;
      const cached = cache?.get(cacheKey);
      if (cached) {
        reuseImageState(imageProps, callbacks, cached, usesWebp);
        return;
      }

      const oldState = state.current.get(imageProps.uid);
      if (
        oldState &&
        !oldState.loading &&
        oldState.displayWidth === imageProps.displayWidth &&
        oldState.displayHeight === imageProps.displayHeight
      ) {
        reuseImageState(imageProps, callbacks, oldState, usesWebp);
        return;
      }

      let curProps: OsehImageProps | null = imageProps;
      let curState: OsehImageState = {
        localUrl: null,
        displayWidth: imageProps.displayWidth,
        displayHeight: imageProps.displayHeight,
        alt: imageProps.alt,
        loading: true,
      };
      state.current.set(imageProps.uid, curState);
      onStateChanged.current.call({
        uid: imageProps.uid,
        old: oldState ?? null,
        current: curState,
      });
      const onPropsChanged = (event: ImageStatesRefHandlingChangedEvent) => {
        if (event.current === null) {
          curProps = null;
          callbacks.remove(onPropsChanged);
        } else {
          curProps = event.current;
        }
      };
      callbacks.add(onPropsChanged);

      if (imageProps.isPublic) {
        const playlist = await fetchPublicPlaylist(imageProps.uid);
        if (curProps === null || !active) {
          return;
        }

        callbacks.remove(onPropsChanged);
        handleUsingPlaylist(curProps, callbacks, playlist.playlist, playlist.jwt, usesWebp);
      } else {
        if (imageProps.jwt === null) {
          throw new Error('Image jwt must be specified for private images');
        }

        const playlist = await fetchPrivatePlaylist(imageProps.uid, imageProps.jwt);
        if (curProps === null || !active) {
          return;
        }

        callbacks.remove(onPropsChanged);
        handleUsingPlaylist(curProps, callbacks, playlist, imageProps.jwt, usesWebp);
      }
    }

    async function handleUsingPlaylist(
      initialProps: OsehImageProps,
      callbacks: Callbacks<ImageStatesRefHandlingChangedEvent>,
      playlist: Playlist,
      jwt: string,
      usesWebp: boolean
    ) {
      const cacheKey = `${initialProps.uid}-${initialProps.displayWidth}-${initialProps.displayHeight}`;
      const cached = cache?.get(cacheKey);
      if (cached) {
        // Case 1: This exact export is available in the cache
        reuseImageState(initialProps, callbacks, cached, usesWebp, playlist, jwt);
        return;
      }

      let curProps: OsehImageProps | null = initialProps;
      const onPropsChanged = (event: ImageStatesRefHandlingChangedEvent) => {
        if (event.current === null) {
          curProps = null;
          callbacks.remove(onPropsChanged);
        } else {
          curProps = event.current;
        }
      };
      callbacks.add(onPropsChanged);

      const bestImage = selectBestItemUsingPixelRatio({
        playlist: playlist,
        usesWebp,
        logical: {
          width: initialProps.displayWidth,
          height: initialProps.displayHeight,
        },
        preferredPixelRatio: devicePixelRatio,
      });

      const uncroppedCacheKey = `${initialProps.uid}-unc-${bestImage.item.width}-${bestImage.item.height}`;
      const uncroppedCached = cache?.get(uncroppedCacheKey);
      let loadedState: OsehImageState;
      if (uncroppedCached) {
        // Case 2: We have cached the uncropped version of this image already, though we
        // may have previously used it either cropped or for a different size (e.g., we
        // might use a 50x50 image for both 25x25 and 50x50)
        const uncroppedLocalUrl = uncroppedCached.localUrl;
        if (uncroppedLocalUrl === null) {
          throw new Error('Uncropped local url must be defined within cache');
        }
        const croppedLocalUrl = bestImage.cropTo
          ? await cropImage(uncroppedLocalUrl, bestImage.cropTo)
          : uncroppedLocalUrl;
        if (!active) {
          return;
        }
        loadedState = {
          localUrl: croppedLocalUrl,
          displayWidth: initialProps.displayWidth,
          displayHeight: initialProps.displayHeight,
          alt: initialProps.alt,
          loading: false,
        };
      } else {
        // Case 3: we have to actually download the image
        const downloaded = await downloadItem(bestImage.item, jwt, { cropTo: bestImage.cropTo });
        if (!active) {
          return;
        }

        const uncroppedLoadedState: OsehImageState = {
          localUrl: downloaded.originalLocalUrl,
          displayWidth: bestImage.item.width,
          displayHeight: bestImage.item.height,
          alt: initialProps.alt,
          loading: false,
        };
        cache?.add(uncroppedCacheKey, uncroppedLoadedState);

        loadedState = {
          localUrl: downloaded.localUrl,
          displayWidth: initialProps.displayWidth,
          displayHeight: initialProps.displayHeight,
          alt: initialProps.alt,
          loading: false,
        };
      }

      cache?.add(cacheKey, loadedState);
      if (curProps === null || !active) {
        return;
      }

      if (curProps !== initialProps) {
        callbacks.remove(onPropsChanged);
        handleUsingPlaylist(curProps, callbacks, playlist, jwt, usesWebp);
        return;
      }

      callbacks.remove(onPropsChanged);
      reuseImageState(initialProps, callbacks, loadedState, usesWebp, playlist, jwt);
    }

    function reuseImageState(
      imageProps: OsehImageProps,
      callbacks: Callbacks<ImageStatesRefHandlingChangedEvent>,
      stateToReuse: OsehImageState,
      usesWebp: boolean,
      playlist?: Playlist,
      jwt?: string
    ) {
      if (imageProps.uid === null) {
        throw new Error('Image uid must be specified');
      }

      const oldState = state.current.get(imageProps.uid) ?? null;
      if (oldState !== stateToReuse) {
        state.current.set(imageProps.uid, stateToReuse);
        onStateChanged.current.call({
          uid: imageProps.uid,
          old: oldState,
          current: stateToReuse,
        });
      }

      const onChange = (event: ImageStatesRefHandlingChangedEvent) => {
        if (event.current === null) {
          state.current.delete(event.uid);
          onStateChanged.current.call({
            uid: event.uid,
            old: oldState,
            current: null,
          });
        } else {
          if (
            event.current.displayWidth === imageProps.displayWidth &&
            event.current.displayHeight === imageProps.displayHeight
          ) {
            return;
          }

          callbacks.remove(onChange);
          if (!playlist || !jwt || isJWTExpired(jwt)) {
            handleImage(event.current, callbacks, usesWebp);
          } else {
            handleUsingPlaylist(event.current, callbacks, playlist, jwt, usesWebp);
          }
        }
      };
      callbacks.add(onChange);
    }
  }, [cacheSize]);

  return useMemo(
    () => ({
      state,
      onStateChanged,
      handling,
      onHandlingChanged,
    }),
    []
  );
};

/**
 * A convenience function which returns a promise that resolves the next
 * time the image state changes.
 */
export const waitUntilNextImageStateUpdate = async (imageStates: OsehImageStatesRef) => {
  return new Promise<OsehImageStateChangedEvent>((resolve) => {
    const onChange = (event: OsehImageStateChangedEvent) => {
      imageStates.onStateChanged.current.remove(onChange);
      resolve(event);
    };
    imageStates.onStateChanged.current.add(onChange);
  });
};

/**
 * A convenience function like waitUntilNextImageStateUpdate, but which is cancelable.
 */
export const waitUntilNextImageStateUpdateCancelable = (
  imageStates: OsehImageStatesRef
): CancelablePromise<OsehImageStateChangedEvent> => {
  let active = true;
  let canceler: () => void = () => {
    active = false;
  };
  const promise = new Promise<OsehImageStateChangedEvent>((resolve, reject) => {
    if (!active) {
      reject();
      return;
    }

    const onChange = (event: OsehImageStateChangedEvent) => {
      if (!active) {
        return;
      }

      imageStates.onStateChanged.current.remove(onChange);
      active = false;
      resolve(event);
    };

    canceler = () => {
      if (!active) {
        return;
      }

      active = false;
      imageStates.onStateChanged.current.remove(onChange);
      reject();
    };

    imageStates.onStateChanged.current.add(onChange);
  });
  return {
    promise,
    cancel: () => canceler(),
    done: () => !active,
  };
};
