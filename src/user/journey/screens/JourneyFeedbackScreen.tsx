import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import styles from './JourneyFeedbackScreen.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { Button } from '../../../shared/forms/Button';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { ease, easeInOut, easeOutBack } from '../../../shared/lib/Bezier';
import {
  BezierAnimation,
  animIsComplete,
  calculateAnimValue,
} from '../../../shared/lib/BezierAnimation';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { BezierAnimator, BezierColorAnimator } from '../../../shared/anim/AnimationLoop';
import { useAnimatedValueWithCallbacks } from '../../../shared/anim/useAnimatedValueWithCallbacks';

/**
 * Asks the user for feedback about the journey so that we can curate the
 * content that they see.
 */
export const JourneyFeedbackScreen = ({
  journey,
  shared,
  setScreen,
}: JourneyScreenProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const responseVWC = useWritableValueWithCallbacks<number | null>(() => null);
  const emojiStatesVWCs = useMemo(
    () =>
      [0, 1, 2, 3].map(() =>
        createWritableValueWithCallbacks<FeedbackButtonState>({
          rotation: 0,
          scale: 1,
          ...getTarget(false),
        })
      ),
    []
  );

  // Manages the emoji rotation & scale when a response is selected
  useEffect(() => {
    let active = true;
    let canceled = new Callbacks<undefined>();
    let animations: {
      rotation: BezierAnimation[];
      scale: BezierAnimation[];
    } | null = null;
    let animating = false;

    startManaging();
    return () => {
      if (active) {
        active = false;
        canceled.call(undefined);
      }
    };

    function startManaging() {
      onResponseChanged();

      responseVWC.callbacks.add(onResponseChanged);

      canceled.add(() => {
        responseVWC.callbacks.remove(onResponseChanged);
      });
    }

    function onResponseChanged() {
      clearStyles();

      const response = responseVWC.get();
      if (response === null) {
        animations = null;
        return;
      }

      const scaleFirstDirection = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
      animations = {
        rotation: [
          {
            from: 0,
            to: 360 * (Math.random() > 0.5 ? 1 : -1),
            startedAt: null,
            ease: easeOutBack,
            duration: 1000,
          },
        ],
        scale: [
          {
            from: 1,
            to: 1 + 0.1 * scaleFirstDirection,
            startedAt: null,
            ease: ease,
            duration: 200,
          },
          {
            from: 1 + 0.1 * scaleFirstDirection,
            to: 1 - 0.1 * scaleFirstDirection,
            startedAt: null,
            ease: easeInOut,
            duration: 400,
          },
          {
            from: 1 - 0.1 * scaleFirstDirection,
            to: 1,
            startedAt: null,
            ease: ease,
            duration: 200,
          },
        ],
      };
      if (!animating) {
        animating = true;
        requestAnimationFrame(onFrame);
      }
    }

    function clearStyles() {
      emojiStatesVWCs.forEach((s, idx) => {
        setVWC(
          s,
          {
            ...s.get(),
            rotation: 0,
            scale: 1,
          },
          emojiStateEqualityFn
        );
      });
    }

    function onFrame(now: DOMHighResTimeStamp) {
      const response = responseVWC.get();
      if (!active || animations === null || response === null) {
        animating = false;
        return;
      }

      while (animations.rotation.length > 0 && animIsComplete(animations.rotation[0], now)) {
        animations.rotation.shift();
      }

      while (animations.scale.length > 0 && animIsComplete(animations.scale[0], now)) {
        animations.scale.shift();
      }

      if (animations.rotation.length === 0 && animations.scale.length === 0) {
        clearStyles();
        animating = false;
        return;
      }

      const rotation =
        animations.rotation.length === 0 ? 0 : calculateAnimValue(animations.rotation[0], now);
      const scale =
        animations.scale.length === 0 ? 1 : calculateAnimValue(animations.scale[0], now);
      setVWC(
        emojiStatesVWCs[response - 1],
        {
          ...emojiStatesVWCs[response - 1].get(),
          rotation,
          scale,
        },
        emojiStateEqualityFn
      );
      requestAnimationFrame(onFrame);
    }
  }, [emojiStatesVWCs, responseVWC]);

  useSimpleButtonAnimators(emojiStatesVWCs[0], responseVWC, 1);
  useSimpleButtonAnimators(emojiStatesVWCs[1], responseVWC, 2);
  useSimpleButtonAnimators(emojiStatesVWCs[2], responseVWC, 3);
  useSimpleButtonAnimators(emojiStatesVWCs[3], responseVWC, 4);

  const storeResponse = useCallback(async () => {
    const response = responseVWC.get();
    if (response === null || loginContext.state !== 'logged-in') {
      return;
    }

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
  }, [loginContext, responseVWC, journey.uid, journey.jwt]);

  const onX = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      storeResponse();
      setScreen('post', true);
    },
    [setScreen, storeResponse]
  );

  const onContinue = onX;

  const clickResponse = useMemo<((e: React.MouseEvent<HTMLButtonElement>) => void)[]>(
    () =>
      [1, 2, 3, 4].map((i) => (e) => {
        e.preventDefault();
        setVWC(responseVWC, i);
      }),
    [responseVWC]
  );

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(shared, (s) => s.blurredImage)}
        />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <button type="button" className={styles.close} onClick={onX}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </button>
          </div>
        </div>

        <div className={styles.primaryContainer}>
          <div className={styles.question}>
            <div className={styles.title}>How did that feel?</div>
            <div className={styles.answers}>
              <FeedbackButton
                onClick={clickResponse[0]}
                emoji={'😍'}
                text="Loved"
                state={emojiStatesVWCs[0]}
              />
              <FeedbackButton
                onClick={clickResponse[1]}
                emoji={'😌'}
                text="Liked"
                state={emojiStatesVWCs[1]}
              />
              <FeedbackButton
                onClick={clickResponse[2]}
                emoji={'😕'}
                text="Disliked"
                state={emojiStatesVWCs[2]}
              />
              <FeedbackButton
                onClick={clickResponse[3]}
                emoji={'☹️'}
                text="Hated"
                state={emojiStatesVWCs[3]}
              />
            </div>
          </div>
          <div className={styles.continueContainer}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(responseVWC, (r) => r !== null)}
              component={(haveResponse) => (
                <Button
                  type="button"
                  variant={haveResponse ? 'filled-white' : 'link-white'}
                  onClick={onContinue}
                  fullWidth>
                  {haveResponse ? 'Continue' : 'Skip'}
                </Button>
              )}
            />
            <div className={styles.infoText}>
              Your ratings will be used to personalize your experience
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

type FeedbackButtonState = {
  /* 0-1 grayscale strength */
  grayscale: number;
  /* degrees */
  rotation: number;
  /* 0-1 scale */
  scale: number;
  /* 0-255 rgb, 0-1 opacity */
  gradient: {
    color1: [number, number, number, number];
    color2: [number, number, number, number];
  };
};

const emojiStateEqualityFn = (a: FeedbackButtonState, b: FeedbackButtonState) =>
  a.grayscale === b.grayscale && a.rotation === b.rotation && a.scale === b.scale;

type FeedbackButtonProps = {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  emoji: string;
  text: string;
  state: ValueWithCallbacks<FeedbackButtonState>;
};

const FeedbackButton = ({
  onClick,
  emoji,
  text,
  state: stateVWC,
}: FeedbackButtonProps): React.ReactElement => {
  const emojiRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useValueWithCallbacksEffect(
    stateVWC,
    useCallback((state) => {
      if (emojiRef.current === null || buttonRef.current === null) {
        return;
      }
      const container = buttonRef.current;
      const emoji = emojiRef.current;
      emoji.style.transform = `rotate(${state.rotation}deg) scale(${state.scale})`;
      emoji.style.filter = `grayscale(${state.grayscale * 100}%)`;
      container.style.background = `linear-gradient(95.08deg, rgba(${state.gradient.color1.join(
        ','
      )}) 2.49%, rgba(${state.gradient.color2.join(',')}) 97.19%)`;
      return undefined;
    }, [])
  );

  return (
    <button className={styles.answer} onClick={onClick} ref={buttonRef}>
      <div className={styles.answerEmoji} ref={emojiRef}>
        {emoji}
      </div>
      <div className={styles.answerText}>{text}</div>
    </button>
  );
};

type SimpleFeedbackButtonState = {
  grayscale: number;
  gradient: FeedbackButtonState['gradient'];
};

const getTarget = (selected: boolean): SimpleFeedbackButtonState => {
  return selected
    ? {
        grayscale: 0,
        gradient: {
          color1: [87, 184, 162, 1],
          color2: [0, 153, 153, 1],
        },
      }
    : {
        grayscale: 1,
        gradient: {
          color1: [68, 98, 102, 0.4],
          color2: [68, 98, 102, 0.4],
        },
      };
};

const useSimpleButtonAnimators = (
  stateVWC: WritableValueWithCallbacks<FeedbackButtonState>,
  responseVWC: ValueWithCallbacks<number | null>,
  response: number
) => {
  const target = useAnimatedValueWithCallbacks<SimpleFeedbackButtonState>(
    getTarget(responseVWC.get() === response),
    () => [
      new BezierAnimator(
        ease,
        350,
        (p) => p.grayscale,
        (p, v) => (p.grayscale = v)
      ),
      new BezierColorAnimator(
        ease,
        350,
        (p) => p.gradient.color1,
        (p, v) => (p.gradient.color1 = v)
      ),
      new BezierColorAnimator(
        ease,
        350,
        (p) => p.gradient.color2,
        (p, v) => (p.gradient.color2 = v)
      ),
    ],
    (p) => {
      setVWC(
        stateVWC,
        {
          ...stateVWC.get(),
          ...p,
        },
        emojiStateEqualityFn
      );
    }
  );

  useValueWithCallbacksEffect(
    responseVWC,
    useCallback(
      (selected) => {
        setVWC(
          target,
          getTarget(selected === response),
          (a, b) =>
            a.grayscale === b.grayscale &&
            a.gradient.color1.every((v, i) => v === b.gradient.color1[i]) &&
            a.gradient.color2.every((v, i) => v === b.gradient.color2[i])
        );
        return undefined;
      },
      [response, target]
    )
  );
};
