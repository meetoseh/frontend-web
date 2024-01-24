import { ReactElement, useCallback, useContext, useRef } from 'react';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import styles from './JourneyFeedbackScreen.module.css';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { Button } from '../../../shared/forms/Button';
import { IconButtonWithLabel } from '../../../shared/forms/IconButtonWithLabel';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useToggleFavorited } from '../hooks/useToggleFavorited';
import { useShareClass } from '../hooks/useShareClass';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { JourneyFeedback } from '../components/JourneyFeedback';
import {
  base64URLToByteArray,
  computeAverageRGBAUsingThumbhash,
} from '../../../shared/lib/colorUtils';
import { VerticalLayout } from '../../../shared/responsive/VerticalLayout';
import { useVerticalLayout } from '../../../shared/responsive/useVerticalLayout';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { OsehImageProps } from '../../../shared/images/OsehImageProps';
import { useStaleOsehImageOnSwap } from '../../../shared/images/useStaleOsehImageOnSwap';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { areOsehImageStatesEqual } from '../../../shared/images/OsehImageState';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { apiFetch } from '../../../shared/ApiConstants';
import { useReactManagedValueAsValueWithCallbacks } from '../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import {
  useRefVWC,
  useResponsiveRefs,
  useSetRef,
} from '../../../shared/responsive/useResponsiveRefs';

type VLKey =
  | 'topPadding'
  | 'image'
  | 'imageFeedbackMargin'
  | 'feedback'
  | 'feedbackControlsMargin'
  | 'finish'
  | 'finishAnotherMargin'
  | 'another'
  | 'bottomPadding';

const baseVerticalLayout: VerticalLayout<VLKey> = {
  topPadding: { minHeight: 48, scaling: { 2: { end: 96 }, 3: {} } },
  image: { minHeight: 237, scaling: { 1: { end: 390 } } },
  imageFeedbackMargin: { minHeight: 32, scaling: {} },
  feedback: { minHeight: 93, scaling: {} },
  feedbackControlsMargin: { minHeight: 32, scaling: {} },
  finish: { minHeight: 56, scaling: {} },
  finishAnotherMargin: { minHeight: 12, scaling: {} },
  another: { minHeight: 56, scaling: {} },
  bottomPadding: { minHeight: 20, scaling: { 2: { end: 40 }, 3: {} } },
};

const baseVerticalLayoutWithoutAnother: VerticalLayout<VLKey> = {
  ...baseVerticalLayout,
  finishAnotherMargin: { minHeight: 0, scaling: {} },
  another: { minHeight: 0, scaling: {} },
};

const verticalLayoutKeys = Object.keys(baseVerticalLayout) as VLKey[];
const verticalLayoutApplyKeys = [
  'topPadding',
  'imageFeedbackMargin',
  'feedbackControlsMargin',
  'finishAnotherMargin',
  'bottomPadding',
] as const;

/**
 * Asks the user for feedback about the journey so that we can curate the
 * content that they see. They are also given the opportunity to jump straight
 * into another class or share the class they just took (if it's shareable)
 */
export const JourneyFeedbackScreen = ({
  journey,
  shared,
  takeAnother,
  setScreen,
}: JourneyScreenProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);

  const toggleFavorited = useToggleFavorited({
    journey: { type: 'react-rerender', props: journey },
    shared,
  });
  const shareClass = useShareClass({ journey: { type: 'react-rerender', props: journey } });
  const onToggleFavorited = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      toggleFavorited();
    },
    [toggleFavorited]
  );
  const onShareClass = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      shareClass.shareClass();
    },
    [shareClass]
  );

  const responseVWC = useWritableValueWithCallbacks<number | null>(() => null);

  const backgroundAverageRGB = useMappedValueWithCallbacks(
    shared,
    (s): [number, number, number] => {
      if (s.darkenedImage.thumbhash === null) {
        return [0.2, 0.2, 0.2];
      }

      const thumbhashBytes = base64URLToByteArray(s.darkenedImage.thumbhash);
      const averageRGBA = computeAverageRGBAUsingThumbhash(thumbhashBytes);
      return [averageRGBA[0], averageRGBA[1], averageRGBA[2]];
    },
    {
      outputEqualityFn: (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2],
    }
  );

  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const height = useMappedValueWithCallbacks(windowSizeVWC, (s) => s.height);

  const refs = useResponsiveRefs(verticalLayoutKeys);

  const layout = useReactManagedValueAsValueWithCallbacks(
    (() => {
      if (takeAnother === null) {
        return baseVerticalLayoutWithoutAnother;
      }
      return baseVerticalLayout;
    })(),
    Object.is
  );

  const [, appliedVerticalLayout, scrollingRequired] = useVerticalLayout(layout, height, refs);

  const feedbackImageProps = useMappedValuesWithCallbacks(
    [appliedVerticalLayout, windowSizeVWC],
    (): OsehImageProps => ({
      uid: journey.darkenedBackgroundImage.uid,
      jwt: journey.darkenedBackgroundImage.jwt,
      displayWidth: Math.min(342, windowSizeVWC.get().width - 48),
      displayHeight: appliedVerticalLayout.get().image,
      alt: '',
    })
  );

  const imageHandler = useOsehImageStateRequestHandler({});
  const feedbackImageRaw = useStaleOsehImageOnSwap(
    useOsehImageStateValueWithCallbacks(
      {
        type: 'callbacks',
        props: feedbackImageProps.get,
        callbacks: feedbackImageProps.callbacks,
      },
      imageHandler
    )
  );
  const feedbackImage = useMappedValuesWithCallbacks(
    [feedbackImageRaw, shared],
    () => {
      const v = feedbackImageRaw.get();
      if (v.thumbhash !== null) {
        return v;
      }
      return {
        ...v,
        thumbhash: shared.get().darkenedImage.thumbhash,
      };
    },
    {
      outputEqualityFn: areOsehImageStatesEqual,
    }
  );

  useValuesWithCallbacksEffect(
    [appliedVerticalLayout, ...verticalLayoutApplyKeys.map((key) => refs[key].ref)],
    () => {
      const applied = appliedVerticalLayout.get();
      verticalLayoutApplyKeys.forEach((key) => {
        const ele = refs[key].ref.get();
        if (ele === null) {
          return;
        }

        ele.style.minHeight = `${applied[key]}px`;
      });
      return undefined;
    }
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useValueWithCallbacksEffect(scrollingRequired, (req) => {
    if (containerRef.current === null) {
      return undefined;
    }
    const ele = containerRef.current;
    if (req) {
      ele.style.position = 'relative';
      ele.style.bottom = 'unset';
    } else {
      ele.style.position = 'absolute';
      ele.style.bottom = '0';
    }
  });

  const storeResponse = useCallback(async () => {
    const response = responseVWC.get();
    const loginContextUnch = loginContextRaw.value.get();
    if (response === null || loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;

    const resp = await apiFetch(
      '/api/1/journeys/feedback',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          journey_uid: journey.uid,
          journey_jwt: journey.jwt,
          version: 'oseh_jf-otp_sKjKVHs8wbI',
          response: response,
          feedback: null,
        }),
        keepalive: true,
      },
      loginContext
    );

    if (!resp.ok) {
      console.warn('Failed to store feedback response', resp);
    }
  }, [loginContextRaw, responseVWC, journey.uid, journey.jwt]);

  const onContinue = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      storeResponse();
      setScreen('post', true);
    },
    [setScreen, storeResponse]
  );

  const onTakeAnother = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      storeResponse();
      takeAnother?.onTakeAnother();
    },
    [storeResponse, takeAnother]
  );

  const anotherForwardRefVWC = useRefVWC('another', refs);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(shared, (s) => s.blurredImage)}
        />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.primaryContainer}>
          <div ref={useSetRef('topPadding', refs)} />
          <div className={styles.shareContainer} ref={useSetRef('image', refs)}>
            <div className={styles.shareBackground}>
              <OsehImageFromStateValueWithCallbacks state={feedbackImage} />
            </div>
            <div className={styles.shareForeground}>
              <div className={styles.shareInfo}>
                <div className={styles.shareTitle}>{journey.title}</div>
                <div className={styles.shareInstructor}>{journey.instructor.name}</div>
              </div>
              <div className={styles.shareControls}>
                <RenderGuardedComponent
                  props={shareClass.shareable}
                  component={(shareable) =>
                    shareable === false ? (
                      <></>
                    ) : (
                      <RenderGuardedComponent
                        props={shareClass.working}
                        component={(working) => (
                          <IconButtonWithLabel
                            iconClass={styles.iconShare}
                            label="Share Class"
                            onClick={onShareClass}
                            disabled={working}
                            spinner={working}
                          />
                        )}
                      />
                    )
                  }
                />
                <RenderGuardedComponent
                  props={shared}
                  component={(s) => (
                    <>
                      {s.favorited !== null && (
                        <IconButtonWithLabel
                          iconClass={s.favorited ? styles.iconFullHeart : styles.iconEmptyHeart}
                          label="Favorite"
                          onClick={onToggleFavorited}
                        />
                      )}
                    </>
                  )}
                />
              </div>
            </div>
          </div>
          <div ref={useSetRef('imageFeedbackMargin', refs)} />
          <div className={styles.feedbackContainer} ref={useSetRef('feedback', refs)}>
            <div className={styles.feedbackTitle}>How did that class feel?</div>
            <JourneyFeedback response={responseVWC} backgroundAverageRGB={backgroundAverageRGB} />
          </div>
          <div ref={useSetRef('feedbackControlsMargin', refs)} />
          <div className={styles.controlsContainer}>
            <Button
              type="button"
              variant="filled-white"
              fullWidth
              refVWC={useRefVWC('finish', refs)}
              onClick={onContinue}>
              Finish
            </Button>
            <div ref={useSetRef('finishAnotherMargin', refs)} />
            {takeAnother !== null && (
              <Button
                type="button"
                variant="outlined-white"
                fullWidth
                refVWC={anotherForwardRefVWC}
                onClick={onTakeAnother}>
                Take another {takeAnother.emotion} class
              </Button>
            )}
          </div>
          <div ref={useSetRef('bottomPadding', refs)} />
        </div>
      </div>
    </div>
  );
};
