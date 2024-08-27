import { ReactElement, useCallback, useContext, useEffect } from 'react';
import { LoginContext, LoginProvider } from '../shared/contexts/LoginContext';
import { SplashScreen } from './splash/SplashScreen';
import { apiFetch } from '../shared/ApiConstants';
import { useFonts } from '../shared/lib/useFonts';
import { InterestsAutoProvider } from '../shared/contexts/InterestsContext';
import { useTimedValueWithCallbacks } from '../shared/hooks/useTimedValue';
import { RenderGuardedComponent } from '../shared/components/RenderGuardedComponent';
import { useWritableValueWithCallbacks } from '../shared/lib/Callbacks';
import { setVWC } from '../shared/lib/setVWC';
import { useMappedValuesWithCallbacks } from '../shared/hooks/useMappedValuesWithCallbacks';
import { useValuesWithCallbacksEffect } from '../shared/hooks/useValuesWithCallbacksEffect';
import { useValueWithCallbacksEffect } from '../shared/hooks/useValueWithCallbacksEffect';
import { ModalProvider } from '../shared/contexts/ModalContext';
import { useScreenQueueState } from './core/hooks/useScreenQueueState';
import { useScreenContext } from './core/hooks/useScreenContext';
import { useScreenQueue } from './core/hooks/useScreenQueue';
import { OsehScreen, ScreenResources } from './core/models/Screen';
import { useMappedValueWithCallbacks } from '../shared/hooks/useMappedValueWithCallbacks';
import { ConfirmationScreen } from './core/screens/confirmation/ConfirmationScreen';
import { USES_WEBP } from '../shared/images/usesWebp';
import { USES_SVG } from '../shared/images/usesSvg';
import { ImageInterstitialScreen } from './core/screens/image_interstitial/ImageInterstitialScreen';
import { VideoInterstitialScreen } from './core/screens/video_interstitial/VideoInterstitialScreen';
import { ForkScreen } from './core/screens/fork/ForkScreen';
import { SeriesListScreen } from './core/screens/series_list/SeriesListScreen';
import { SeriesDetailsScreen } from './core/screens/series_details/SeriesDetailsScreen';
import { UpgradeScreen } from './core/screens/upgrade/UpgradeScreen';
import { LoginApp } from './login/LoginApp';
import { InteractivePromptScreen } from './core/screens/interactive_prompt_screen/InteractivePromptScreen';
import { AudioInterstitialScreen } from './core/screens/audio_interstitial/AudioInterstitialScreen';
import { JourneyFeedbackScreen } from './core/screens/journey_feedback/JourneyFeedbackScreen';
import { HomeScreen } from './core/screens/home/HomeScreen';
import { EmotionScreen } from './core/screens/emotion/EmotionScreen';
import { SettingsScreen } from './core/screens/settings/SettingsScreen';
import { FavoritesScreen } from './core/screens/favorites/FavoritesScreen';
import { HistoryScreen } from './core/screens/history/HistoryScreen';
import { OwnedScreen } from './core/screens/owned/OwnedScreen';
import { MembershipScreen } from './core/screens/membership/MembershipScreen';
import { ReminderTimesScreen } from './core/screens/reminder_times/ReminderTimesScreen';
import { SetGoalScreen } from './core/screens/set_goal/SetGoalScreen';
import { AddPhoneScreen } from './core/screens/add_phone/AddPhoneScreen';
import { VerifyPhoneScreen } from './core/screens/verify_phone/VerifyPhoneScreen';
import { SetNameScreen } from './core/screens/set_name/SetNameScreen';
import { ChooseAFeelingScreen } from './core/screens/choose_a_feeling/ChooseAFeelingScreen';
import { RateClassScreen } from './core/screens/rate_class/RateClassScreen';
import { ChoicesScreen } from './core/screens/choices/ChoicesScreen';
import { StartMergeScreen } from './core/screens/start_merge/StartMergeScreen';
import { ResolveMergeConflictScreen } from './core/screens/resolve_merge_conflict/ResolveMergeConflictScreen';
import { CompletionScreen } from './core/screens/completion/CompletionScreen';
import { VideoInterstitialOnboardingScreen } from './core/screens/video_interstitial_onboarding/VideoInterstitialOnboardingScreen';
import { useHandleTouchLink } from './core/lib/handleTouchLink';
import { FastUnsubscribeLoginApp } from './login/FastUnsubscribeLoginApp';
import { JournalChatScreen } from './core/screens/journal_chat/JournalChatScreen';
import { SimpleHomeScreen } from './core/screens/simple_home/SimpleHomeScreen';
import { LargeImageInterstitialScreen } from './core/screens/large_image_interstitial/LargeImageInterstitialScreen';
import { SimpleNavScreen } from './core/screens/simple_nav/SimpleNavScreen';
import { ChatMessageExamplesScreen } from './core/screens/chat_message_examples/ChatMessageExamplesScreen';
import { FeedbackScreen } from './core/screens/feedback/FeedbackScreen';
import { JournalReflectionLargeScreen } from './core/screens/journal_reflection_large/JournalReflectionLargeScreen';
import { JournalReflectionResponseScreen } from './core/screens/journal_reflection_response/JournalReflectionResponseScreen';
import { JournalEntryViewScreen } from './core/screens/journal_entry_view/JournalEntryViewScreen';
import { JournalEntriesListScreen } from './core/screens/journal_entries_list/JournalEntriesListScreen';
import { JournalEntrySummaryScreen } from './core/screens/journal_entry_summary/JournalEntrySummaryScreen';
import { LibraryScreen } from './core/screens/library/LibraryScreen';
import { LibraryFilterScreen } from './core/screens/library_filter/LibraryFilterScreen';
import { HomeV4Screen } from './core/screens/homev4/HomeV4Screen';

export default function UserScreensApp(): ReactElement {
  const imageFormatsVWC = useWritableValueWithCallbacks<{
    usesWebp: boolean;
    usesSvg: boolean;
  } | null>(() => null);

  useEffect(() => {
    let active = true;
    check();
    return () => {
      active = false;
    };

    async function check() {
      const [usesWebp, usesSvg] = await Promise.all([USES_WEBP, USES_SVG]);
      if (!active) {
        return;
      }
      setVWC(imageFormatsVWC, { usesWebp, usesSvg });
    }
  });

  return (
    <LoginProvider>
      <InterestsAutoProvider>
        <ModalProvider>
          <RenderGuardedComponent
            props={imageFormatsVWC}
            component={(fmts) => (fmts === null ? <></> : <UserScreensAppInner {...fmts} />)}
          />
        </ModalProvider>
      </InterestsAutoProvider>
    </LoginProvider>
  );
}

const requiredFonts = [
  '300 1em Open Sans',
  '400 1em Open Sans',
  'italic 400 1em Open Sans',
  '600 1em Open Sans',
  '700 1em Open Sans',
];

const screens = [
  ConfirmationScreen,
  ImageInterstitialScreen,
  VideoInterstitialScreen,
  ForkScreen,
  SeriesListScreen,
  SeriesDetailsScreen,
  UpgradeScreen,
  InteractivePromptScreen,
  AudioInterstitialScreen,
  JourneyFeedbackScreen,
  HomeScreen,
  EmotionScreen,
  SettingsScreen,
  FavoritesScreen,
  HistoryScreen,
  OwnedScreen,
  MembershipScreen,
  ReminderTimesScreen,
  SetGoalScreen,
  AddPhoneScreen,
  VerifyPhoneScreen,
  SetNameScreen,
  ChooseAFeelingScreen,
  RateClassScreen,
  ChoicesScreen,
  StartMergeScreen,
  ResolveMergeConflictScreen,
  CompletionScreen,
  VideoInterstitialOnboardingScreen,
  JournalChatScreen,
  SimpleHomeScreen,
  LargeImageInterstitialScreen,
  SimpleNavScreen,
  ChatMessageExamplesScreen,
  FeedbackScreen,
  JournalReflectionLargeScreen,
  JournalReflectionResponseScreen,
  JournalEntryViewScreen,
  JournalEntriesListScreen,
  JournalEntrySummaryScreen,
  LibraryScreen,
  LibraryFilterScreen,
  HomeV4Screen,
] as any[] as readonly OsehScreen<string, ScreenResources, object, { __mapped?: true }>[];

/**
 * Initializes a screen queue and renders the current screen component or a spinner
 */
const UserScreensAppInner = ({
  usesWebp,
  usesSvg,
}: {
  usesWebp: boolean;
  usesSvg: boolean;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const fontsLoaded = useFonts(requiredFonts);

  const screenContext = useScreenContext(usesWebp, usesSvg);
  const touchLink = useHandleTouchLink({ ctx: screenContext });
  const screenQueueState = useScreenQueueState({ touchLink });
  const screenQueue = useScreenQueue({
    screenQueueState,
    screenContext,
    screens,
    logging:
      process.env.REACT_APP_ENVIRONMENT === 'dev' ||
      localStorage.getItem('debug-screens') === 'true'
        ? {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
          }
        : {
            log: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
          },
  });

  const stateVWC = useWritableValueWithCallbacks<'loading' | 'error' | 'features'>(() => 'loading');
  // Since on first load the user likely sees white anyway, it's better to leave
  // it white and then go straight to the content if we can do so rapidly, rather
  // than going white screen -> black screen (start of splash) -> content. Of course,
  // if loading takes a while, we'll show the splash screen.
  const flashWhiteInsteadOfSplashVWC = useTimedValueWithCallbacks(true, false, 250);
  const beenLoadedVWC = useWritableValueWithCallbacks<boolean>(() => false);

  const handlingStripeSyncVWC = useWritableValueWithCallbacks<boolean>(() => true);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        let active = true;
        checkStripeSync();
        return () => {
          active = false;
        };

        async function checkStripeSync() {
          if (!active) {
            return;
          }

          if (loginContextUnch.state === 'logged-out') {
            setVWC(handlingStripeSyncVWC, false);
            return;
          }

          if (loginContextUnch.state !== 'logged-in') {
            return;
          }

          const searchParams = new URLSearchParams(window.location.search);
          if (!searchParams.has('sync')) {
            setVWC(handlingStripeSyncVWC, false);
            return;
          }

          try {
            const response = await apiFetch(
              '/api/1/users/me/stripe/sync',
              {
                method: 'POST',
              },
              loginContextUnch
            );
            if (!active) {
              return;
            }
            if (response.ok) {
              const newParams = new URLSearchParams(window.location.search);
              newParams.delete('sync');
              window.history.replaceState(
                {},
                document.title,
                `${window.location.pathname}?${newParams.toString()}`
              );
            }
          } finally {
            if (active) {
              setVWC(handlingStripeSyncVWC, false);
            }
          }
        }
      },
      [handlingStripeSyncVWC]
    )
  );

  const screenQueueTypeVWC = useMappedValueWithCallbacks(screenQueue.value, (v) => v.type);
  useValuesWithCallbacksEffect(
    [loginContextRaw.value, screenQueueTypeVWC, handlingStripeSyncVWC],
    useCallback((): undefined => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state === 'loading' || !fontsLoaded || handlingStripeSyncVWC.get()) {
        setVWC(stateVWC, 'loading');
        return;
      }

      const sqType = screenQueueTypeVWC.get();
      if (sqType === 'spinner') {
        setVWC(stateVWC, 'loading');
        return;
      }

      if (sqType === 'error') {
        setVWC(stateVWC, 'error');
        return;
      }

      setVWC(beenLoadedVWC, true);
      setVWC(stateVWC, 'features');
    }, [
      loginContextRaw.value,
      fontsLoaded,
      screenQueueTypeVWC,
      beenLoadedVWC,
      stateVWC,
      handlingStripeSyncVWC,
    ])
  );

  const splashTypeVWC = useMappedValuesWithCallbacks(
    [flashWhiteInsteadOfSplashVWC, beenLoadedVWC],
    (): 'white' | 'word' | 'brand' => {
      if (beenLoadedVWC.get()) {
        return 'brand';
      }
      if (flashWhiteInsteadOfSplashVWC.get()) {
        return 'white';
      }
      return 'word';
    }
  );

  const overlaySpinnerOnFeatures = useMappedValueWithCallbacks(
    screenQueue.value,
    (v) => v.type === 'finishing-pop' || v.type === 'spinner'
  );

  const needLoginScreen = useMappedValueWithCallbacks(
    loginContextRaw.value,
    (v) => v.state === 'logged-out'
  );

  return (
    <RenderGuardedComponent
      props={needLoginScreen}
      component={(needLogin) => {
        if (needLogin) {
          return (
            <RenderGuardedComponent
              props={touchLink.loggedOutPage}
              component={(page) => {
                if (page === undefined) {
                  return <SplashScreen type="wordmark" />;
                }

                if (page === null) {
                  return <LoginApp />;
                }

                if (page.pageIdentifier === 'unsubscribe') {
                  return (
                    <FastUnsubscribeLoginApp
                      ctx={screenContext}
                      page={page as typeof page & { pageIdentifier: 'unsubscribe' }}
                    />
                  );
                }

                return <LoginApp />;
              }}
            />
          );
        }

        return (
          <div>
            <RenderGuardedComponent
              props={stateVWC}
              component={(state) => {
                if (state === 'features') {
                  return (
                    <>
                      <RenderGuardedComponent
                        props={screenQueue.value}
                        component={(sq) => sq.component ?? <></>}
                      />
                      <RenderGuardedComponent
                        props={overlaySpinnerOnFeatures}
                        component={(overlay) =>
                          overlay ? <SplashScreen type="brandmark" /> : <></>
                        }
                      />
                    </>
                  );
                }

                if (state === 'error') {
                  return (
                    <RenderGuardedComponent
                      props={screenQueue.value}
                      component={(sq) =>
                        sq.error ?? <div>An error has occurred. Try refreshing.</div>
                      }
                    />
                  );
                }

                return (
                  <RenderGuardedComponent
                    props={splashTypeVWC}
                    component={(splashType) => {
                      if (splashType === 'brand') {
                        return <SplashScreen type="brandmark" />;
                      }
                      if (splashType === 'word') {
                        return <SplashScreen type="wordmark" />;
                      }
                      return <></>;
                    }}
                  />
                );
              }}
            />
          </div>
        );
      }}
    />
  );
};
