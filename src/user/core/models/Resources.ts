import { OsehContentRefLoadable } from '../../../shared/content/OsehContentRef';
import {
  AudioFileData,
  ContentFileWebExportRef,
  OsehContentPlaylist,
  VideoFileData,
} from '../../../shared/content/OsehContentTarget';
import { LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
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
import { PurchasesStoreProduct } from '../features/upgrade/models/PurchasesStoreProduct';
import { RevenueCatOffering } from '../features/upgrade/models/RevenueCatOffering';
import { ExpirableJourneyRef } from '../screens/journey_feedback/lib/ExpirableJourneyRef';
import { JourneyMinimalRef } from '../screens/journey_feedback/lib/JourneyMinimalRef';
import { JourneyShareableInfo } from '../screens/journey_feedback/lib/createIsJourneyShareableRequestHandler';
import { JourneyLikeState } from '../screens/journey_feedback/lib/createJourneyLikeStateRequestHandler';
import { JourneyShareLink } from '../screens/journey_feedback/lib/createJourneyShareLinkRequestHandler';
import { OfferingPriceRef } from '../screens/upgrade/lib/createOfferingPriceRequestHandler';

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
   * Manages downloading audio data for the audio player
   */
  audioDataHandler: RequestHandler<ContentFileWebExportRef, AudioFileData>;
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
  /**
   * Manages fetching the current revenue cat offering
   */
  offeringHandler: RequestHandler<LoginContextValueLoggedIn, RevenueCatOffering>;
  /**
   * Manages downloading product prices
   */
  priceHandler: RequestHandler<OfferingPriceRef, PurchasesStoreProduct>;
  /**
   * Determines if a journey can be shared
   */
  journeyIsShareableHandler: RequestHandler<JourneyMinimalRef, JourneyShareableInfo>;
  /**
   * Actually creates share links for journeys
   */
  journeyShareLinkHandler: RequestHandler<JourneyMinimalRef, JourneyShareLink>;
  /**
   * Manages creating objects that keep track if the user has liked a journey
   */
  journeyLikeStateHandler: RequestHandler<ExpirableJourneyRef, JourneyLikeState>;
};
