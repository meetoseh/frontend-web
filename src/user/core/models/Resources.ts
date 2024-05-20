import { OsehImageExport } from '../../../shared/images/OsehImageExport';
import { OsehImageExportCropped } from '../../../shared/images/OsehImageExportCropped';
import { OsehImageExportCroppedRef } from '../../../shared/images/OsehImageExportCroppedRef';
import { OsehImageExportRef } from '../../../shared/images/OsehImageExportRef';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { OsehPublicImageRef } from '../../../shared/images/OsehPublicImageRef';
import { PlaylistWithJWT } from '../../../shared/images/Playlist';
import { RequestHandler } from '../../../shared/requests/RequestHandler';

/**
 * Contains everything that any screen might want to eagerly preload. Generally,
 * if the resource is cacheable (like an image) and might be used by more than
 * one user client screen (e.g., two instances of the same screen), it should be
 * requested and received via the Resources object.
 *
 * If a resource is either trivial (e.g., some local computation) or is extremely
 * specific, it can be loaded per-instance instead.
 */
export type Resources = {
  /**
   * Manages downloading private playlists
   */
  privatePlaylistHandler: RequestHandler<OsehImageRef, PlaylistWithJWT>;
  /**
   * Manages downloading public playlists
   */
  publicPlaylistHandler: RequestHandler<OsehPublicImageRef, PlaylistWithJWT>;
  /**
   * Manages downloading raw image assets
   */
  imageDataHandler: RequestHandler<OsehImageExportRef, OsehImageExport>;
  /**
   * Manages cropping downloaded image assets
   */
  imageCropHandler: RequestHandler<OsehImageExportCroppedRef, OsehImageExportCropped>;
};
