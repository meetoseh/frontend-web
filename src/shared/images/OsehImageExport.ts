import { PlaylistItem } from './Playlist';

export type OsehImageExport = {
  /** The image file UID  */
  imageFileUid: string;
  /** The playlist item corresponding to this image export */
  item: PlaylistItem;
  /** The URL constructed via createObjectURL pointing to the already downloaded contents */
  localUrl: string;
};
