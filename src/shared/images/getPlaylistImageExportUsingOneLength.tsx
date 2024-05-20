import { largestPhysicalPerLogical } from './DisplayRatioHelper';
import { AspectRatioComparer } from './LogicalSize';
import { OsehImageExportRef } from './OsehImageExportRef';
import { PlaylistWithJWT, selectBestItemUsingPixelRatio } from './Playlist';

/**
 * Extracts the image export ref to use from a playlist, based on a fixed
 * value for either the width or the height, but not both, and a way to determine
 * which aspect ratio is preferable
 *
 * @see getPlaylistImageExportUsingFixedSize to fix both the width and height
 *   using cropping
 */
export const getPlaylistImageExportRefUsingOneLength = ({
  side,
  compareAspectRatios,
  playlist,
  usesWebp,
  usesSvg,
}: {
  side:
    | { displayWidth: number; displayHeight?: undefined }
    | { displayWidth?: undefined; displayHeight: number };
  compareAspectRatios: AspectRatioComparer;
  playlist: PlaylistWithJWT;
  usesWebp: boolean;
  usesSvg: boolean;
}): OsehImageExportRef => {
  const bestItem = selectBestItemUsingPixelRatio({
    playlist: playlist.playlist,
    usesWebp,
    usesSvg,
    logical:
      side.displayWidth === undefined
        ? { width: null, height: side.displayHeight, compareAspectRatios }
        : { width: side.displayWidth, height: null, compareAspectRatios },
    preferredPixelRatio: largestPhysicalPerLogical,
  });
  return {
    imageFile: { uid: playlist.playlist.uid, jwt: playlist.jwt },
    item: bestItem.item,
  };
};
