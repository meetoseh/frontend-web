import { ReactElement, useCallback, useEffect, useRef } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { WelcomeVideoResources } from './WelcomeVideoResources';
import { WelcomeVideoState } from './WelcomeVideoState';
import styles from './WelcomeVideo.module.css';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useCurrentTranscriptPhrases } from '../../../../shared/transcripts/useCurrentTranscriptPhrases';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { useMediaInfo } from '../../../../shared/content/useMediaInfo';
import { PlayerCTA, PlayerForeground } from '../../../../shared/content/player/PlayerForeground';
import { useOsehTranscriptValueWithCallbacks } from '../../../../shared/transcripts/useOsehTranscriptValueWithCallbacks';

/**
 * Displays the full screen welcome video
 */
export const WelcomeVideo = ({
  state,
  resources,
}: FeatureComponentProps<WelcomeVideoState, WelcomeVideoResources>): ReactElement => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  useStartSession(
    adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(resources, (r) => r.session)
    ),
    {
      onStart: () => {
        const onboardingVideo = resources.get().onboardingVideo;
        resources.get().session?.storeAction('open', {
          onboarding_video_uid:
            onboardingVideo.type === 'success' ? onboardingVideo.result.onboardingVideoUid : null,
          content_file_uid:
            onboardingVideo.type === 'success' ? onboardingVideo.result.video.uid : null,
        });
      },
    }
  );

  const videoVWC = useMappedValueWithCallbacks(resources, (r) => r.video);
  const videoSinkVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useValuesWithCallbacksEffect([windowSizeVWC, videoSinkVWC], () => {
    const size = windowSizeVWC.get();
    const sink = videoSinkVWC.get();

    if (sink === null) {
      return undefined;
    }

    sink.style.width = `${size.width}px`;
    sink.style.height = `${size.height}px`;
    return undefined;
  });

  useValuesWithCallbacksEffect(
    [videoVWC, videoSinkVWC],
    useCallback(() => {
      const video = videoVWC.get();
      const sink = videoSinkVWC.get();

      if (video.state !== 'loaded' || sink === null) {
        return undefined;
      }

      const vid = video.element;
      sink.appendChild(vid);
      return () => {
        vid.remove();
      };
    }, [videoSinkVWC, videoVWC])
  );

  const coverImageStateVWC = useMappedValueWithCallbacks(resources, (r) => r.coverImage);

  const transcriptRefVWC = useMappedValueWithCallbacks(
    resources,
    (r) => r.onboardingVideo.result?.transcript ?? null,
    {
      outputEqualityFn: (a, b) =>
        a === null || b === null ? a === b : a.uid === b.uid && a.jwt === b.jwt,
    }
  );
  const rawTranscriptVWC = useOsehTranscriptValueWithCallbacks(
    adaptValueWithCallbacksAsVariableStrategyProps(transcriptRefVWC)
  );

  const transcript = useCurrentTranscriptPhrases({
    transcript: useMappedValueWithCallbacks(rawTranscriptVWC, (v) =>
      v.type === 'loading' ? null : v.type === 'success' ? v.transcript : undefined
    ),
  });
  const mediaInfo = useMediaInfo({
    mediaVWC: videoVWC,
    currentTranscriptPhrasesVWC: transcript,
  });

  const reportedPlayingRef = useRef<boolean>(false);
  useValueWithCallbacksEffect(mediaInfo.playing, (playing) => {
    if (playing === reportedPlayingRef.current) {
      return undefined;
    }
    reportedPlayingRef.current = playing;
    if (playing) {
      resources.get().session?.storeAction('play', null);
    } else {
      if (!mediaInfo.ended.get()) {
        resources.get().session?.storeAction('pause', { time: mediaInfo.currentTime.get() });
      }
    }
    return undefined;
  });

  useValueWithCallbacksEffect(
    mediaInfo.ended,
    useCallback(
      (ended) => {
        if (ended) {
          resources.get().session?.storeAction('ended', null);
          resources.get().session?.reset();
          state.get().ian?.onShown();
        }
        return undefined;
      },
      [resources, state]
    )
  );

  useEffect(() => {
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };

    function onBeforeUnload() {
      resources.get().session?.storeAction('close', null);
    }
  });

  const cta = useWritableValueWithCallbacks(
    (): PlayerCTA => ({
      title: 'Skip',
      action: async () => {
        resources.get().session?.storeAction('close', null);
        resources.get().session?.reset();
        state.get().ian?.onShown();
      },
    })
  );

  const title = useWritableValueWithCallbacks(() => 'Welcome to Oseh');

  return (
    <div className={styles.container}>
      <div className={styles.background} ref={(v) => setVWC(videoSinkVWC, v)}>
        <RenderGuardedComponent
          props={mediaInfo.loaded}
          component={(loaded) =>
            !loaded ? <OsehImageFromStateValueWithCallbacks state={coverImageStateVWC} /> : <></>
          }
        />
      </div>
      <div className={styles.playerForeground}>
        <PlayerForeground
          size={windowSizeVWC}
          content={videoVWC}
          mediaInfo={mediaInfo}
          transcript={transcript}
          title={title}
          cta={cta}
        />
      </div>
    </div>
  );
};
