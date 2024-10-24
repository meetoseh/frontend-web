import { OsehImageRef } from './OsehImageRef';
import { PlaylistItem } from './Playlist';

/**
 * Describes the minimum information required to reference a specific
 * image export.
 */
export type OsehImageExportRef = {
  /** The ref for the image file this export is a part of */
  imageFile: OsehImageRef;
  /** The playlist item within the images playlist corresponding to this item */
  item: PlaylistItem;
};
