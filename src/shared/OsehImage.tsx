import { ReactElement, useEffect, useMemo, useState } from 'react';
import { HTTP_API_URL } from './ApiConstants';

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

type OsehImageProps = {
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
  const state = useOsehImageState(props);
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
}: OsehImageState): ReactElement => {
  return (
    <img
      src={localUrl === null ? require('./placeholder.png') : localUrl}
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
export const useOsehImageState = ({
  uid,
  jwt,
  displayWidth,
  displayHeight,
  alt,
  isPublic = false,
  setLoading = null,
}: OsehImageProps): OsehImageState => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [publicJwt, setPublicJwt] = useState<string | null>(null);
  const [item, setItem] = useState<PlaylistItem | null>(null);
  const [downloadedItem, setDownloadedItem] = useState<{
    localUrl: string;
    remoteUrl: string;
  } | null>(null);

  useEffect(() => {
    if (uid === null) {
      setPlaylist(null);
      return;
    }

    let alive = true;
    fetchPlaylist();
    return () => {
      alive = false;
    };

    async function fetchPlaylist() {
      if (playlist?.uid === uid) {
        return;
      }

      const response = isPublic
        ? await fetch(`${HTTP_API_URL}/api/1/image_files/playlist/${uid}?public=1`, {
            method: 'GET',
          })
        : await fetch(`${HTTP_API_URL}/api/1/image_files/playlist/${uid}`, {
            method: 'GET',
            headers: { authorization: `bearer ${jwt}` },
          });
      if (!alive) {
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        if (!alive) {
          return;
        }
        console.error("Couldn't fetch playlist", response, text);
        return;
      }

      const data = await response.json();
      if (!alive) {
        return;
      }

      if (response.headers.has('x-image-file-jwt')) {
        setPublicJwt(response.headers.get('x-image-file-jwt'));
      } else {
        setPublicJwt(null);
      }
      setPlaylist(data);
    }
  }, [uid, jwt, playlist?.uid, isPublic]);

  useEffect(() => {
    if (playlist === null) {
      setItem(null);
      return;
    }

    let alive = true;
    selectItem();
    return () => {
      alive = false;
    };

    async function selectItem() {
      const usesWebp = await USES_WEBP;
      if (!alive) {
        return;
      }
      if (playlist === null) {
        return;
      }

      const desiredImageSize = {
        width: Math.round(window.devicePixelRatio * displayWidth),
        height: Math.round(window.devicePixelRatio * displayHeight),
      };
      const desiredArea = desiredImageSize.width * desiredImageSize.height;

      const format =
        usesWebp && playlist.items.webp
          ? 'webp'
          : desiredArea <= 200 * 200 && playlist.items.png
          ? 'png'
          : 'jpeg';

      // items is already sorted by size, ascending
      let items = playlist.items[format];

      const itemByResolution: { [resolution: string]: PlaylistItem } = {};
      for (const item of items) {
        itemByResolution[`${item.width}x${item.height}`] = item;
      }
      items = Object.values(itemByResolution);

      const bestItem = items.reduce((best, item) => {
        if (best === null) {
          return item;
        }
        if (compareSizes(desiredImageSize, item, best) < 0) {
          return item;
        }
        return best;
      });

      setItem(bestItem);
    }
  }, [playlist, displayWidth, displayHeight]);

  useEffect(() => {
    let active = true;
    fetchItemUrl();
    return () => {
      active = false;
    };

    async function fetchItemUrl() {
      if (item === null) {
        setDownloadedItem(null);
        return;
      }

      if (downloadedItem?.remoteUrl === item.url) {
        return;
      }

      let response: Response;
      try {
        response = await fetch(item.url, {
          headers: { Authorization: `bearer ${publicJwt ?? jwt}` },
        });
      } catch (e) {
        console.error(`Couldn't fetch ${item.url}`, e);
        setDownloadedItem(null);
        return;
      }
      if (!active) {
        return;
      }

      const blob = await response.blob();
      if (!active) {
        return;
      }

      setDownloadedItem({ localUrl: URL.createObjectURL(blob), remoteUrl: item.url });
    }
  }, [item, jwt, downloadedItem?.remoteUrl, publicJwt]);

  useEffect(() => {
    if (setLoading !== null) {
      setLoading(uid === null || downloadedItem === null, uid);
    }
  }, [downloadedItem, setLoading, uid]);

  return useMemo(() => {
    return {
      localUrl: downloadedItem?.localUrl ?? null,
      alt,
      displayWidth,
      displayHeight,
      loading: uid === null || downloadedItem?.localUrl === null,
    };
  }, [downloadedItem?.localUrl, alt, displayWidth, displayHeight, uid]);
};
