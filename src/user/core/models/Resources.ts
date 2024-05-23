import { OsehContentRefLoadable } from '../../../shared/content/OsehContentRef';
import {
  ContentFileWebExportRef,
  OsehContentPlaylist,
  VideoFileData,
} from '../../../shared/content/OsehContentTarget';
import { OsehImageExport } from '../../../shared/images/OsehImageExport';
import { OsehImageExportCropped } from '../../../shared/images/OsehImageExportCropped';
import { OsehImageExportCroppedRef } from '../../../shared/images/OsehImageExportCroppedRef';
import { OsehImageExportRef } from '../../../shared/images/OsehImageExportRef';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { OsehPublicImageRef } from '../../../shared/images/OsehPublicImageRef';
import { PlaylistWithJWT } from '../../../shared/images/Playlist';
import { InfiniteListing } from '../../../shared/lib/InfiniteListing';
import { RequestHandler } from '../../../shared/requests/RequestHandler';
import { CourseRef } from '../../favorites/lib/CourseRef';
import { ExpirableCourseRef } from '../../series/lib/ExpirableCourseRef';
import { ExternalCourse } from '../../series/lib/ExternalCourse';
import { CourseJourneys } from '../../series/lib/createSeriesJourneysRequestHandler';
import { CourseLikeState } from '../../series/lib/createSeriesLikeStateRequestHandler';
import { SeriesListRequest } from '../../series/lib/createSeriesListRequestHandler';

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
  /**
   * Manages downloading content playlists, i.e., the web broadly compatible
   * equivalent to m3u8 files (lists out all the available encodings of a video
   * or audio file). This isn't necessary on the web as we directly supply the
   * api path for the m3u8 file to play to the video player
   */
  contentPlaylistHandler: RequestHandler<OsehContentRefLoadable, OsehContentPlaylist>;
  /**
   * Manages downloading video data for the video player
   */
  videoDataHandler: RequestHandler<ContentFileWebExportRef, VideoFileData>;
  /**
   * Manages creating objects that can paginate through the list of series
   */
  seriesListHandler: RequestHandler<SeriesListRequest, InfiniteListing<ExternalCourse>>;
  /**
   * Manages creating objects that keep track if the user has liked a series
   */
  seriesLikeStateHandler: RequestHandler<ExpirableCourseRef, CourseLikeState>;
  /**
   * Manages getting the journeys that are part of a series
   */
  seriesJourneysHandler: RequestHandler<CourseRef, CourseJourneys>;
};
