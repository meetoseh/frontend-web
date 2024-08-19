import { useContext, useEffect, useMemo } from 'react';
import {
  InterestsContext,
  InterestsContextProvidedValue,
} from '../../../shared/contexts/InterestsContext';
import { LoginContext, LoginContextValue } from '../../../shared/contexts/LoginContext';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { Resources } from '../models/Resources';
import { setVWC } from '../../../shared/lib/setVWC';
import { useDelayedValueWithCallbacks } from '../../../shared/hooks/useDelayedValueWithCallbacks';
import { useContentWidthValueWithCallbacks } from '../../../shared/lib/useContentWidthValueWithCallbacks';
import { createImagePrivatePlaylistRequestHandler } from '../../../shared/images/createImagePrivatePlaylistRequestHandler';
import { createImagePublicPlaylistRequestHandler } from '../../../shared/images/createImagePublicPlaylistRequestHandler';
import { createImageDataRequestHandler } from '../../../shared/images/createImageDataRequestHandler';
import { createImageCropRequestHandler } from '../../../shared/images/createImageCropRequestHandler';
import { createContentPlaylistRequestHandler } from '../../../shared/content/createContentPlaylistRequestHandler';
import { createVideoDataRequestHandler } from '../../../shared/content/createVideoDataHandler';
import { createSeriesListRequestHandler } from '../../series/lib/createSeriesListRequestHandler';
import { createSeriesLikeStateRequestHandler } from '../../series/lib/createSeriesLikeStateRequestHandler';
import { createSeriesJourneysRequestHandler } from '../../series/lib/createSeriesJourneysRequestHandler';
import { createOfferingRequestHandler } from '../screens/upgrade/lib/createOfferingRequestHandler';
import { createOfferingPriceRequestHandler } from '../screens/upgrade/lib/createOfferingPriceRequestHandler';
import { createAudioDataRequestHandler } from '../../../shared/content/createAudioDataHandler';
import { createIsJourneyShareableRequestHandler } from '../screens/journey_feedback/lib/createIsJourneyShareableRequestHandler';
import { createJourneyShareLinkRequestHandler } from '../screens/journey_feedback/lib/createJourneyShareLinkRequestHandler';
import { createJourneyLikeStateRequestHandler } from '../screens/journey_feedback/lib/createJourneyLikeStateRequestHandler';
import { createSessionStateRequestHandler } from '../screens/home/lib/createSessionStateRequestHandler';
import { createHomeCopyRequestHandler } from '../screens/home/lib/createHomeCopyRequestHandler';
import { createHomeImageRequestHandler } from '../screens/home/lib/createHomeImageRequestHandler';
import { createProfilePictureRequestHandler } from '../screens/home/lib/createProfilePictureRequestHandler';
import { createStreakRequestHandler } from '../screens/home/lib/createStreakRequestHandler';
import { createEmotionsRequestHandler } from '../screens/home/lib/createEmotionsRequestHandler';
import { createIdentitiesRequestHandler } from '../screens/settings/lib/createIdentitiesRequestHandler';
import { createEntitlementsRequestHandler } from '../screens/settings/lib/createEntitlementRequestHandler';
import { createFavoritesListRequestHandler } from '../screens/favorites/lib/createFavoritesListRequestHandler';
import { createHistoryListRequestHandler } from '../screens/history/lib/createHistoryListRequestHandler';
import { createOwnedListRequestHandler } from '../screens/owned/lib/createOwnedListRequestHandler';
import { createManageMembershipUrlRequestHandler } from '../screens/membership/lib/createManageMembershipUrlRequestHandler';
import { createReminderChannelsRequestHandler } from '../screens/reminder_times/lib/createReminderChannelsHandler';
import { createReminderSettingsRequestHandler } from '../screens/reminder_times/lib/createReminderSettingsHandler';
import { createOnboardingVideoRequestHandler } from '../screens/video_interstitial_onboarding/lib/createOnboardingVideoRequestHandler';
import { createTranscriptRequestHandler } from '../screens/video_interstitial/lib/createTranscriptRequestHandler';
import { createTouchLinkRequestHandler } from '../lib/createTouchLinkRequestHandler';
import { createJournalEntryManagerRequestHandler } from '../screens/journal_chat/lib/createJournalEntryManagerHandler';
import { createJournalEntryMetadataRequestHandler } from '../screens/journal_chat/lib/createJournalEntryMetadataRequestHandler';
import { createJournalEntryListRequestHandler } from '../screens/journal_entries_list/lib/createJournalEntryListRequestHandler';

type WindowSize = {
  width: number;
  height: number;
};

/**
 * Shared state between all screens.
 */
export type ScreenContext = {
  /**
   * User login state, i.e., whether the user is logged in or not and basic information
   * about them. Can also be used for authenticating requests via `apiFetch`.
   */
  login: LoginContextValue;

  /**
   * Contains RequestHandler-like objects which allow for requesting resources
   * in such a way that they can be shared between multiple screens.
   */
  resources: Resources;

  /**
   * The size of the window, as if by `useWindowSize`. This will be updated
   * without delay, so caution needs to be taken to account for potentially
   * rapid (every frame) changes in window size if the user is dragging.
   *
   * Often it makes sense to use `windowSizeImmediate` for the HTML size
   * to render images and `windowSizeDebounced` for downloading images.
   */
  windowSizeImmediate: ValueWithCallbacks<WindowSize>;

  /**
   * A debounced version of `windowSizeImmediate`, as if via
   * `useDelayedValueWithCallbacks(windowSizeImmediate)` with an
   * arbitrary but small delay (to avoid inconsistency on the debounce
   * timeout).
   */
  windowSizeDebounced: ValueWithCallbacks<WindowSize>;

  /**
   * The suggested width of the content area for app-like screens. This will
   * allow for the appropriate horizontal padding when centered within the
   * viewport. Updates immediately when the window size changes.
   */
  contentWidth: ValueWithCallbacks<number>;

  /**
   * The visitor and how they signed up with oseh (i.e, their interests)
   */
  interests: InterestsContextProvidedValue;

  /** True to use webp images, false never to use webp images */
  usesWebp: boolean;

  /** True to use svg vector images, false never to use svg vector images */
  usesSvg: boolean;
};

const areWindowSizesEqual = (a: WindowSize, b: WindowSize): boolean =>
  a.width === b.width && a.height === b.height;

/**
 * Initializes a new screen context that can be used by screens managed by
 * `useScreenQueue`
 */
export const useScreenContext = (usesWebp: boolean, usesSvg: boolean): ScreenContext => {
  const loginContext = useContext(LoginContext);
  const interestsContext = useContext(InterestsContext);

  const windowSizeImmediate = useWritableValueWithCallbacks<{ width: number; height: number }>(
    () => {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
  );

  useEffect(() => {
    let active = true;
    window.addEventListener('resize', update);
    update();
    return () => {
      active = false;
      window.removeEventListener('resize', update);
    };

    function update() {
      if (!active) {
        return;
      }

      setVWC(
        windowSizeImmediate,
        {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        areWindowSizesEqual
      );
    }
  }, [windowSizeImmediate]);

  const windowSizeDebounced = useDelayedValueWithCallbacks(windowSizeImmediate, 100);
  const logging = 'none';
  const cacheSize = 100;
  const privatePlaylistHandler = useWritableValueWithCallbacks(() =>
    createImagePrivatePlaylistRequestHandler({ logging, maxStale: cacheSize })
  );
  const publicPlaylistHandler = useWritableValueWithCallbacks(() =>
    createImagePublicPlaylistRequestHandler({ logging, maxStale: cacheSize })
  );
  const imageDataHandler = useWritableValueWithCallbacks(() =>
    createImageDataRequestHandler({ logging, maxStale: cacheSize })
  );
  const imageCropHandler = useWritableValueWithCallbacks(() =>
    createImageCropRequestHandler({ logging, maxStale: cacheSize })
  );
  const contentPlaylistHandler = useWritableValueWithCallbacks(() =>
    createContentPlaylistRequestHandler({ logging, maxStale: cacheSize })
  );
  const videoDataHandler = useWritableValueWithCallbacks(() =>
    createVideoDataRequestHandler({ logging, maxStale: 2 })
  );
  const audioDataHandler = useWritableValueWithCallbacks(() =>
    createAudioDataRequestHandler({ logging, maxStale: 2 })
  );
  const seriesListHandler = useWritableValueWithCallbacks(() =>
    createSeriesListRequestHandler({ logging, maxStale: 2, loginContextRaw: loginContext })
  );
  const seriesLikeStateHandler = useWritableValueWithCallbacks(() =>
    createSeriesLikeStateRequestHandler({ logging, maxStale: 10, loginContextRaw: loginContext })
  );
  const seriesJourneysHandler = useWritableValueWithCallbacks(() =>
    createSeriesJourneysRequestHandler({ logging, maxStale: 10, loginContextRaw: loginContext })
  );
  const offeringHandler = useWritableValueWithCallbacks(() =>
    createOfferingRequestHandler({ logging, maxStale: 2 })
  );
  const priceHandler = useWritableValueWithCallbacks(() =>
    createOfferingPriceRequestHandler({ logging, maxStale: 10 })
  );
  const journeyIsShareableHandler = useWritableValueWithCallbacks(() =>
    createIsJourneyShareableRequestHandler({
      logging,
      maxStale: 100,
      loginContextRaw: loginContext,
    })
  );
  const journeyShareLinkHandler = useWritableValueWithCallbacks(() =>
    createJourneyShareLinkRequestHandler({ logging, maxStale: 100, loginContextRaw: loginContext })
  );
  const journeyLikeStateHandler = useWritableValueWithCallbacks(() =>
    createJourneyLikeStateRequestHandler({ logging, maxStale: 100, loginContextRaw: loginContext })
  );
  const sessionStateHandler = useWritableValueWithCallbacks(() =>
    createSessionStateRequestHandler({ logging, maxStale: 2 })
  );
  const homeCopyHandler = useWritableValueWithCallbacks(() =>
    createHomeCopyRequestHandler({ logging, maxStale: 2 })
  );
  const homeImageHandler = useWritableValueWithCallbacks(() =>
    createHomeImageRequestHandler({ logging, maxStale: 2 })
  );
  const profilePictureHandler = useWritableValueWithCallbacks(() =>
    createProfilePictureRequestHandler({ logging, maxStale: 2 })
  );
  const streakHandler = useWritableValueWithCallbacks(() =>
    createStreakRequestHandler({ logging, maxStale: 2 })
  );
  const emotionsHandler = useWritableValueWithCallbacks(() =>
    createEmotionsRequestHandler({ logging, maxStale: 2 })
  );
  const identitiesHandler = useWritableValueWithCallbacks(() =>
    createIdentitiesRequestHandler({ logging, maxStale: 2 })
  );
  const entitlementsHandler = useWritableValueWithCallbacks(() =>
    createEntitlementsRequestHandler({ logging, maxStale: 100 })
  );
  const favoritesListHandler = useWritableValueWithCallbacks(() =>
    createFavoritesListRequestHandler({
      logging,
      maxStale: 2,
      loginContextRaw: loginContext,
    })
  );
  const historyListHandler = useWritableValueWithCallbacks(() =>
    createHistoryListRequestHandler({
      logging,
      maxStale: 2,
      loginContextRaw: loginContext,
    })
  );
  const ownedListHandler = useWritableValueWithCallbacks(() =>
    createOwnedListRequestHandler({
      logging,
      maxStale: 2,
      loginContextRaw: loginContext,
    })
  );
  const manageMembershipUrlHandler = useWritableValueWithCallbacks(() =>
    createManageMembershipUrlRequestHandler({ logging, maxStale: 2 })
  );
  const reminderChannelsHandler = useWritableValueWithCallbacks(() =>
    createReminderChannelsRequestHandler({ logging, maxStale: 2 })
  );
  const reminderSettingsHandler = useWritableValueWithCallbacks(() =>
    createReminderSettingsRequestHandler({ logging, maxStale: 2 })
  );
  const onboardingVideoHandler = useWritableValueWithCallbacks(() =>
    createOnboardingVideoRequestHandler({ logging, maxStale: 2 })
  );
  const transcriptHandler = useWritableValueWithCallbacks(() =>
    createTranscriptRequestHandler({ logging, maxStale: 100 })
  );
  const touchLinkHandler = useWritableValueWithCallbacks(() =>
    createTouchLinkRequestHandler({ logging, maxStale: 2 })
  );
  const journalEntryManagerHandler = useWritableValueWithCallbacks(() =>
    createJournalEntryManagerRequestHandler({ logging, maxStale: 100 })
  );
  const journalEntryMetadataHandler = useWritableValueWithCallbacks(() =>
    createJournalEntryMetadataRequestHandler({ logging, maxStale: 100 })
  );
  const journalEntryListHandler = useWritableValueWithCallbacks(() =>
    createJournalEntryListRequestHandler({ logging, maxStale: 100 })
  );

  const resources = useMemo(
    (): Resources => ({
      privatePlaylistHandler: privatePlaylistHandler.get(),
      publicPlaylistHandler: publicPlaylistHandler.get(),
      imageDataHandler: imageDataHandler.get(),
      imageCropHandler: imageCropHandler.get(),
      contentPlaylistHandler: contentPlaylistHandler.get(),
      videoDataHandler: videoDataHandler.get(),
      audioDataHandler: audioDataHandler.get(),
      seriesListHandler: seriesListHandler.get(),
      seriesLikeStateHandler: seriesLikeStateHandler.get(),
      seriesJourneysHandler: seriesJourneysHandler.get(),
      offeringHandler: offeringHandler.get(),
      priceHandler: priceHandler.get(),
      journeyIsShareableHandler: journeyIsShareableHandler.get(),
      journeyShareLinkHandler: journeyShareLinkHandler.get(),
      journeyLikeStateHandler: journeyLikeStateHandler.get(),
      sessionStateHandler: sessionStateHandler.get(),
      homeCopyHandler: homeCopyHandler.get(),
      homeImageHandler: homeImageHandler.get(),
      profilePictureHandler: profilePictureHandler.get(),
      streakHandler: streakHandler.get(),
      emotionsHandler: emotionsHandler.get(),
      identitiesHandler: identitiesHandler.get(),
      entitlementsHandler: entitlementsHandler.get(),
      favoritesListHandler: favoritesListHandler.get(),
      historyListHandler: historyListHandler.get(),
      ownedListHandler: ownedListHandler.get(),
      manageMembershipUrlHandler: manageMembershipUrlHandler.get(),
      reminderChannelsHandler: reminderChannelsHandler.get(),
      reminderSettingsHandler: reminderSettingsHandler.get(),
      onboardingVideoHandler: onboardingVideoHandler.get(),
      transcriptHandler: transcriptHandler.get(),
      touchLinkHandler: touchLinkHandler.get(),
      journalEntryManagerHandler: journalEntryManagerHandler.get(),
      journalEntryMetadataHandler: journalEntryMetadataHandler.get(),
      journalEntryListHandler: journalEntryListHandler.get(),
    }),
    [
      privatePlaylistHandler,
      publicPlaylistHandler,
      imageDataHandler,
      imageCropHandler,
      contentPlaylistHandler,
      videoDataHandler,
      audioDataHandler,
      seriesListHandler,
      seriesLikeStateHandler,
      seriesJourneysHandler,
      offeringHandler,
      priceHandler,
      journeyIsShareableHandler,
      journeyShareLinkHandler,
      journeyLikeStateHandler,
      sessionStateHandler,
      homeCopyHandler,
      homeImageHandler,
      profilePictureHandler,
      streakHandler,
      emotionsHandler,
      identitiesHandler,
      entitlementsHandler,
      favoritesListHandler,
      historyListHandler,
      ownedListHandler,
      manageMembershipUrlHandler,
      reminderChannelsHandler,
      reminderSettingsHandler,
      onboardingVideoHandler,
      transcriptHandler,
      touchLinkHandler,
      journalEntryManagerHandler,
      journalEntryMetadataHandler,
      journalEntryListHandler,
    ]
  );
  const contentWidth = useContentWidthValueWithCallbacks(windowSizeImmediate);

  return useMemo(
    () => ({
      login: loginContext,
      resources,
      windowSizeImmediate,
      windowSizeDebounced,
      contentWidth,
      interests: interestsContext,
      usesWebp,
      usesSvg,
    }),
    [
      loginContext,
      resources,
      interestsContext,
      windowSizeImmediate,
      windowSizeDebounced,
      contentWidth,
      usesWebp,
      usesSvg,
    ]
  );
};
