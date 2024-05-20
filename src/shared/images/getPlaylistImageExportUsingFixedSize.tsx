import { largestPhysicalPerLogical } from './DisplayRatioHelper';
import { OsehImageExportRef } from './OsehImageExportRef';
import { PlaylistWithJWT, selectBestItemUsingPixelRatio } from './Playlist';

/**
 * Extracts the image export ref to use from a playlist, based on a fixed
 * logical size (e.g., the size is specified in CSS pixels)
 *
 * @see getPlaylistImageExportUsingOneLength to adapt to the aspect ratio
 *   of the image
 */
export const getPlaylistImageExportRefUsingFixedSize = ({
  size,
  playlist,
  usesWebp,
  usesSvg,
}: {
  size: { displayWidth: number; displayHeight: number };
  playlist: PlaylistWithJWT;
  usesWebp: boolean;
  usesSvg: boolean;
}): OsehImageExportRef => {
  const bestItem = selectBestItemUsingPixelRatio({
    playlist: playlist.playlist,
    usesWebp,
    usesSvg,
    logical: { width: size.displayWidth, height: size.displayHeight },
    preferredPixelRatio: largestPhysicalPerLogical,
  });
  return {
    imageFile: { uid: playlist.playlist.uid, jwt: playlist.jwt },
    item: bestItem.item,
  };
};
