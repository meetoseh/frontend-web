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
import { DisplaySize } from '../../../shared/images/OsehImageProps';
import { OsehImageRef } from '../../../shared/images/OsehImageRef';
import { OsehPublicImageRef } from '../../../shared/images/OsehPublicImageRef';
import { PlaylistWithJWT } from '../../../shared/images/Playlist';
import { InfiniteListing } from '../../../shared/lib/InfiniteListing';
import { Emotion } from '../../../shared/models/Emotion';
import { OnboardingVideo } from '../../../shared/models/OnboardingVideo';
import { RequestHandler } from '../../../shared/requests/RequestHandler';
import { OsehTranscript } from '../../../shared/transcripts/OsehTranscript';
import { OsehTranscriptRef } from '../../../shared/transcripts/OsehTranscriptRef';
import { CourseRef } from '../../favorites/lib/CourseRef';
import { MinimalCourseJourney } from '../../favorites/lib/MinimalCourseJourney';
import { MinimalJourney } from '../../favorites/lib/MinimalJourney';
import { StreakInfo } from '../../journey/models/StreakInfo';
import { ExpirableCourseRef } from '../../series/lib/ExpirableCourseRef';
import { ExternalCourse } from '../../series/lib/ExternalCourse';
import { CourseJourneys } from '../../series/lib/createSeriesJourneysRequestHandler';
import { CourseLikeState } from '../../series/lib/createSeriesLikeStateRequestHandler';
import { SeriesListRequest } from '../../series/lib/createSeriesListRequestHandler';
import { PurchasesStoreProduct } from '../screens/upgrade/models/PurchasesStoreProduct';
import { RevenueCatOffering } from '../screens/upgrade/models/RevenueCatOffering';
import {
  TouchLink,
  TouchLinkRequest,
  TouchLinkRequestMinimal,
} from '../lib/createTouchLinkRequestHandler';
import { FavoritesListRequest } from '../screens/favorites/lib/createFavoritesListRequestHandler';
import { HistoryListRequest } from '../screens/history/lib/createHistoryListRequestHandler';
import { HomeCopy } from '../screens/home/lib/createHomeCopyRequestHandler';
import { HomeImage } from '../screens/home/lib/createHomeImageRequestHandler';
import { OptionalOsehImageRef } from '../screens/home/lib/createProfilePictureRequestHandler';
import {
  SessionStateSnapshot,
  SessionState,
} from '../screens/home/lib/createSessionStateRequestHandler';
import { ExpirableJourneyRef } from '../screens/journey_feedback/lib/ExpirableJourneyRef';
import { JourneyMinimalRef } from '../screens/journey_feedback/lib/JourneyMinimalRef';
import { JourneyShareableInfo } from '../screens/journey_feedback/lib/createIsJourneyShareableRequestHandler';
import { JourneyLikeState } from '../screens/journey_feedback/lib/createJourneyLikeStateRequestHandler';
import { JourneyShareLink } from '../screens/journey_feedback/lib/createJourneyShareLinkRequestHandler';
import { MembershipUrl } from '../screens/membership/lib/createManageMembershipUrlRequestHandler';
import { OwnedListRequest } from '../screens/owned/lib/createOwnedListRequestHandler';
import { ReminderChannelsInfo } from '../screens/reminder_times/lib/createReminderChannelsHandler';
import { ReminderSettings } from '../screens/reminder_times/lib/createReminderSettingsHandler';
import { Identity } from '../screens/settings/hooks/useIdentities';
import {
  Entitlement,
  EntitlementRef,
} from '../screens/settings/lib/createEntitlementRequestHandler';
import { OfferingPriceRef } from '../screens/upgrade/lib/createOfferingPriceRequestHandler';
import {
  JournalEntryManager,
  JournalEntryManagerMinimalRef,
  JournalEntryManagerRef,
} from '../screens/journal_chat/lib/createJournalEntryManagerHandler';
import {
  JournalEntryMetadata,
  JournalEntryMetadataMinimalRef,
  JournalEntryMetadataRef,
} from '../screens/journal_chat/lib/createJournalEntryMetadataRequestHandler';
import {
  JournalEntryListMinimalRequest,
  JournalEntryListRequest,
  JournalEntryListState,
} from '../screens/journal_entries_list/lib/createJournalEntryListRequestHandler';
import {
  LibraryListMinimalRequest,
  LibraryListRequest,
  LibraryListState,
} from '../screens/library/lib/createLibraryListRequestHandler';
import {
  InstructorListMinimalRequest,
  InstructorListRequest,
  InstructorListState,
} from '../screens/library_filter/lib/createInstructorListRequestHandler';

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
  privatePlaylistHandler: RequestHandler<{ uid: string }, OsehImageRef, PlaylistWithJWT>;
  /**
   * Manages downloading public playlists
   */
  publicPlaylistHandler: RequestHandler<{ uid: string }, OsehPublicImageRef, PlaylistWithJWT>;
  /**
   * Manages downloading raw image assets
   */
  imageDataHandler: RequestHandler<{ item: { uid: string } }, OsehImageExportRef, OsehImageExport>;
  /**
   * Manages cropping downloaded image assets
   */
  imageCropHandler: RequestHandler<
    { export: { item: { uid: string } }; cropTo: DisplaySize },
    OsehImageExportCroppedRef,
    OsehImageExportCropped
  >;
  /**
   * For the web, this downloads the equivalent to an m3u8 file. On native,
   * this is just a small transformation of the input.
   */
  contentPlaylistHandler: RequestHandler<
    { uid: string },
    OsehContentRefLoadable,
    OsehContentPlaylist
  >;
  /**
   * Manages downloading video data for the video player. Not used in native,
   * as we need to mount the component in order to start the download.
   */
  videoDataHandler: RequestHandler<ContentFileWebExportRef, ContentFileWebExportRef, VideoFileData>;
  /**
   * Manages downloading audio data for the audio player.  Not used in native,
   * as we need to mount the component in order to start the download.
   */
  audioDataHandler: RequestHandler<ContentFileWebExportRef, ContentFileWebExportRef, AudioFileData>;
  /**
   * Manages creating objects that can paginate through the list of series
   */
  seriesListHandler: RequestHandler<
    SeriesListRequest,
    SeriesListRequest,
    InfiniteListing<ExternalCourse>
  >;
  /**
   * Manages creating objects that keep track if the user has liked a series
   */
  seriesLikeStateHandler: RequestHandler<
    { course: { uid: string } },
    ExpirableCourseRef,
    CourseLikeState
  >;
  /**
   * Manages getting the journeys that are part of a series
   */
  seriesJourneysHandler: RequestHandler<{ uid: string }, CourseRef, CourseJourneys>;
  /**
   * Manages fetching the current revenue cat offering
   */
  offeringHandler: RequestHandler<
    LoginContextValueLoggedIn,
    LoginContextValueLoggedIn,
    RevenueCatOffering
  >;
  /**
   * Manages downloading product prices
   */
  priceHandler: RequestHandler<OfferingPriceRef, OfferingPriceRef, PurchasesStoreProduct>;
  /**
   * Determines if a journey can be shared
   */
  journeyIsShareableHandler: RequestHandler<
    JourneyMinimalRef,
    JourneyMinimalRef,
    JourneyShareableInfo
  >;
  /**
   * Actually creates share links for journeys
   */
  journeyShareLinkHandler: RequestHandler<JourneyMinimalRef, JourneyMinimalRef, JourneyShareLink>;
  /**
   * Manages creating objects that keep track if the user has liked a journey
   */
  journeyLikeStateHandler: RequestHandler<
    { journey: { uid: string } },
    ExpirableJourneyRef,
    JourneyLikeState
  >;
  /**
   * Manages objects that keep track of recent activity
   */
  sessionStateHandler: RequestHandler<
    LoginContextValueLoggedIn,
    LoginContextValueLoggedIn,
    SessionState
  >;
  /**
   * Downloads the current home copy for the user
   */
  homeCopyHandler: RequestHandler<SessionStateSnapshot, SessionStateSnapshot, HomeCopy>;
  /**
   * Downloads the current home image reference for the user (can chain this to
   * privatePlaylistHandler, etc)
   */
  homeImageHandler: RequestHandler<SessionStateSnapshot, SessionStateSnapshot, HomeImage>;
  /**
   * Determines the current profile picture for the user
   */
  profilePictureHandler: RequestHandler<
    LoginContextValueLoggedIn,
    LoginContextValueLoggedIn,
    OptionalOsehImageRef
  >;
  /**
   * Determines the users streak information
   */
  streakHandler: RequestHandler<LoginContextValueLoggedIn, LoginContextValueLoggedIn, StreakInfo>;
  /**
   * Determines what emotions the user can take classes from
   */
  emotionsHandler: RequestHandler<LoginContextValueLoggedIn, LoginContextValueLoggedIn, Emotion[]>;
  /**
   * The identities the user can use to login
   */
  identitiesHandler: RequestHandler<
    LoginContextValueLoggedIn,
    LoginContextValueLoggedIn,
    Identity[]
  >;
  /**
   * Manages fetching entitlement information
   */
  entitlementsHandler: RequestHandler<EntitlementRef, EntitlementRef, Entitlement>;
  /**
   * Manages creating objects that can paginate through the list of the logged
   * in users favorite classes
   */
  favoritesListHandler: RequestHandler<
    FavoritesListRequest,
    FavoritesListRequest,
    InfiniteListing<MinimalJourney>
  >;
  /**
   * Manages creating objects that can paginate through the list of journeys the
   * logged in user has already taken
   */
  historyListHandler: RequestHandler<
    HistoryListRequest,
    HistoryListRequest,
    InfiniteListing<MinimalJourney>
  >;
  /**
   * Manages creating objects that can paginate through the list of purchased content
   * by the logged in user
   */
  ownedListHandler: RequestHandler<
    OwnedListRequest,
    OwnedListRequest,
    InfiniteListing<MinimalCourseJourney>
  >;
  /**
   * Manages getting the stripe customer portal url for the logged in user
   */
  manageMembershipUrlHandler: RequestHandler<
    LoginContextValueLoggedIn,
    LoginContextValueLoggedIn,
    MembershipUrl
  >;
  /**
   * Manages getting what channels the user can configure and which ones they have
   * already configured
   */
  reminderChannelsHandler: RequestHandler<
    LoginContextValueLoggedIn,
    LoginContextValueLoggedIn,
    ReminderChannelsInfo
  >;
  /**
   * Manages getting the users current reminder settings
   */
  reminderSettingsHandler: RequestHandler<
    LoginContextValueLoggedIn,
    LoginContextValueLoggedIn,
    ReminderSettings
  >;
  /**
   * Manages selecting the appropriate onboarding welcome video for the logged in user
   */
  onboardingVideoHandler: RequestHandler<
    LoginContextValueLoggedIn,
    LoginContextValueLoggedIn,
    OnboardingVideo
  >;
  /**
   * Manages downloading transcripts
   */
  transcriptHandler: RequestHandler<
    Pick<OsehTranscriptRef, 'uid'>,
    OsehTranscriptRef,
    OsehTranscript
  >;
  /**
   * Manages touch links
   */
  touchLinkHandler: RequestHandler<TouchLinkRequestMinimal, TouchLinkRequest, TouchLink>;
  /**
   * Manages streaming journal entries contents
   */
  journalEntryManagerHandler: RequestHandler<
    JournalEntryManagerMinimalRef,
    JournalEntryManagerRef,
    JournalEntryManager
  >;

  /** Manages retrieving metadata on journal entries */
  journalEntryMetadataHandler: RequestHandler<
    JournalEntryMetadataMinimalRef,
    JournalEntryMetadataRef,
    JournalEntryMetadata
  >;

  /** Manages retrieving the users journal entries listing */
  journalEntryListHandler: RequestHandler<
    JournalEntryListMinimalRequest,
    JournalEntryListRequest,
    JournalEntryListState
  >;

  /** Manages searching the journey library */
  libraryListHandler: RequestHandler<
    LibraryListMinimalRequest,
    LibraryListRequest,
    LibraryListState
  >;

  /** Manages searching what instructors should be included in the classes filter */
  instructorsListHandler: RequestHandler<
    InstructorListMinimalRequest,
    InstructorListRequest,
    InstructorListState
  >;
};
