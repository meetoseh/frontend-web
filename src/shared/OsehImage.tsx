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

type DownloadedItem = {
  localUrl: string;
  remoteUrl: string;
};

const downloadedItemsEqual = (a: DownloadedItem | null, b: DownloadedItem | null): boolean => {
  if (a === b) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  return a.localUrl === b.localUrl && a.remoteUrl === b.remoteUrl;
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
  const [playlists, setPlaylists] = useState<{ [uid: string]: Playlist | null }>({});
  const [publicJwts, setPublicJwts] = useState<{ [uid: string]: string | null }>({});
  const [items, setItems] = useState<{ [uid: string]: PlaylistItem | null }>({});
  const [downloadedItems, setDownloadedItems] = useState<{
    [uid: string]: DownloadedItem | null;
  }>({});

  /**
   * Handles setting playlists and public jwts
   */
  useEffect(() => {
    let alive = true;
    fetchPlaylists();
    return () => {
      alive = false;
    };

    async function fetchPlaylists() {
      const currentUids = new Set(images.map((img) => img.uid).filter((uid) => uid !== null));
      const newPlaylists: { [uid: string]: Playlist | null } = Object.assign({}, playlists);
      const newPublicJwts: { [uid: string]: string | null } = Object.assign({}, publicJwts);

      let madeAnyChanges = false;

      Object.keys(newPlaylists).forEach((uid) => {
        if (!currentUids.has(uid)) {
          madeAnyChanges = true;
          delete newPlaylists[uid];
        }
      });
      Object.keys(newPublicJwts).forEach((uid) => {
        if (!currentUids.has(uid)) {
          madeAnyChanges = true;
          delete newPublicJwts[uid];
        }
      });

      const promises: Promise<void>[] = [];
      images.forEach((img) => {
        const imgUid = img.uid;
        if (imgUid === null) {
          return;
        }

        const currentPlaylist = newPlaylists[imgUid] ?? null;
        madeAnyChanges ||= newPlaylists[imgUid] !== currentPlaylist;
        newPlaylists[imgUid] = currentPlaylist;

        const currentPublicJwt = newPublicJwts[imgUid] ?? null;
        madeAnyChanges ||= newPublicJwts[imgUid] !== currentPublicJwt;
        newPublicJwts[imgUid] = currentPublicJwt;

        const currentIsPublic = !!img.isPublic;

        promises.push(
          fetchPlaylist(
            img.uid,
            img.jwt,
            currentPlaylist,
            currentIsPublic,
            currentPublicJwt,
            (jwt) => {
              madeAnyChanges ||= newPublicJwts[imgUid] !== jwt;
              newPublicJwts[imgUid] = jwt;
            },
            (playlist) => {
              madeAnyChanges ||= !playlistsEqual(newPlaylists[imgUid], playlist);
              newPlaylists[imgUid] = playlist;
            }
          )
        );
      });

      await Promise.all(promises);
      if (!alive) {
        return;
      }

      if (!madeAnyChanges) {
        return;
      }

      setPlaylists(newPlaylists);
      setPublicJwts(newPublicJwts);
    }

    async function fetchPlaylist(
      uid: string | null,
      jwt: string | null,
      playlist: Playlist | null,
      isPublic: boolean,
      publicJwt: string | null,
      setPublicJwt: (jwt: string | null) => void,
      setPlaylist: (playlist: Playlist | null) => void
    ) {
      if (!alive) {
        return;
      }

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
  }, [images, playlists, publicJwts]);

  /**
   * Handles selecting items
   */
  useEffect(() => {
    let alive = true;
    selectItems();
    return () => {
      alive = false;
    };

    async function selectItems() {
      const currentUids = new Set(Object.keys(playlists));
      const displaySizes = new Map<string, { width: number; height: number }>();

      for (const img of images) {
        if (img.uid === null) {
          continue;
        }
        displaySizes.set(img.uid, {
          width: img.displayWidth,
          height: img.displayHeight,
        });
      }

      const newItems: { [uid: string]: PlaylistItem | null } = Object.assign({}, items);
      let madeAnyChanges = false;

      Object.keys(newItems).forEach((uid) => {
        if (!currentUids.has(uid)) {
          madeAnyChanges = true;
          delete newItems[uid];
        }
      });

      const promises: Promise<void>[] = [];
      Object.entries(playlists).forEach(([uid, playlist]) => {
        const displaySize = displaySizes.get(uid);

        if (newItems[uid] === undefined) {
          madeAnyChanges = true;
          newItems[uid] = null;
        }

        if (displaySize === undefined) {
          madeAnyChanges ||= newItems[uid] !== null;
          newItems[uid] = null;
          return;
        }

        promises.push(
          selectItem(playlist, displaySize.width, displaySize.height, (item) => {
            madeAnyChanges ||= !playlistItemsEqual(newItems[uid], item);
            newItems[uid] = item;
          })
        );
      });

      await Promise.all(promises);
      if (!alive) {
        return;
      }
      if (!madeAnyChanges) {
        return;
      }

      setItems(newItems);
    }

    async function selectItem(
      playlist: Playlist | null,
      displayWidth: number,
      displayHeight: number,
      setItem: (item: PlaylistItem | null) => void
    ) {
      const usesWebp = await USES_WEBP;
      if (playlist === null) {
        setItem(null);
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
  }, [images, items, playlists]);

  /**
   * Manages downloading the items
   */
  useEffect(() => {
    let active = true;
    fetchItemUrls();
    return () => {
      active = false;
    };

    async function fetchItemUrls() {
      const currentUids = new Set(Object.keys(items));
      const newDownloadedItems: { [uid: string]: DownloadedItem | null } = Object.assign(
        {},
        downloadedItems
      );
      const jwtsByUid = new Map<string, string | null>();
      for (const img of images) {
        if (img.uid === null) {
          continue;
        }
        jwtsByUid.set(img.uid, img.jwt);
      }

      let madeAnyChanges = false;
      Object.keys(newDownloadedItems).forEach((uid) => {
        if (!currentUids.has(uid)) {
          madeAnyChanges = true;
          delete newDownloadedItems[uid];
        }
      });

      const promises: Promise<void>[] = [];
      Object.entries(items).forEach(([uid, item]) => {
        if (item === null) {
          madeAnyChanges ||= newDownloadedItems[uid] !== null;
          newDownloadedItems[uid] = null;
          return;
        }

        if (newDownloadedItems[uid] === undefined) {
          madeAnyChanges = true;
          newDownloadedItems[uid] = null;
        }

        promises.push(
          fetchItemUrl(
            item,
            publicJwts[uid],
            jwtsByUid.get(uid) ?? null,
            downloadedItems[uid],
            (downloadedItem) => {
              madeAnyChanges ||= !downloadedItemsEqual(newDownloadedItems[uid], downloadedItem);
              newDownloadedItems[uid] = downloadedItem;
            }
          )
        );
      });

      await Promise.all(promises);
      if (!active) {
        return;
      }

      if (!madeAnyChanges) {
        return;
      }

      setDownloadedItems(newDownloadedItems);
    }

    async function fetchItemUrl(
      item: PlaylistItem,
      publicJwt: string | null,
      jwt: string | null,
      downloadedItem: DownloadedItem | null,
      setDownloadedItem: (item: DownloadedItem | null) => void
    ) {
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
  }, [images, items, downloadedItems, publicJwts]);

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

      const downloadedItem = downloadedItems[img.uid];
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
        };
      }

      const downloadedItem = downloadedItems[img.uid];
      if (downloadedItem === null || downloadedItem === undefined) {
        return {
          localUrl: null,
          alt: img.alt,
          displayWidth: img.displayWidth,
          displayHeight: img.displayHeight,
          loading: true,
        };
      }

      const localUrl = downloadedItem.localUrl ?? null;

      return {
        localUrl: localUrl,
        alt: img.alt,
        displayWidth: img.displayWidth,
        displayHeight: img.displayHeight,
        loading: localUrl === null,
      };
    });
  }, [images, downloadedItems]);
};
