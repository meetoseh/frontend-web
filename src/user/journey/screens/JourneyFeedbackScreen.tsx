import {
  MutableRefObject,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import styles from './JourneyFeedbackScreen.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { OsehImageFromState } from '../../../shared/OsehImage';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/LoginContext';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { Button } from '../../../shared/forms/Button';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { ease, easeInOut, easeOutBack } from '../../../shared/lib/Bezier';
import {
  BezierAnimation,
  animIsComplete,
  calculateAnimValue,
} from '../../../shared/lib/BezierAnimation';

/**
 * Asks the user for feedback about the journey so that we can curate the
 * content that they see.
 */
export const JourneyFeedbackScreen = ({
  journey,
  shared,
  setScreen,
  onJourneyFinished,
  isOnboarding,
}: JourneyScreenProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [response, setResponse] = useState<number | null>(null);

  const currentResponse = useRef<number | null>() as MutableRefObject<number | null>;
  if (currentResponse.current === undefined) {
    currentResponse.current = null;
  }

  const responseChanged = useRef<Callbacks<undefined>>() as MutableRefObject<Callbacks<undefined>>;
  if (responseChanged.current === undefined) {
    responseChanged.current = new Callbacks();
  }

  if (currentResponse.current !== response) {
    currentResponse.current = response;
    responseChanged.current.call(undefined);
  }

  const emojiRefs = useRef<(HTMLDivElement | null)[]>() as MutableRefObject<
    (HTMLDivElement | null)[]
  >;
  if (emojiRefs.current === undefined) {
    emojiRefs.current = [null, null, null, null];
  }
  const emojiRefsChanged = useRef<Callbacks<undefined>>() as MutableRefObject<Callbacks<undefined>>;
  if (emojiRefsChanged.current === undefined) {
    emojiRefsChanged.current = new Callbacks();
  }

  const setEmojiRefs = useMemo<((ref: HTMLDivElement | null | undefined) => void)[]>(
    () =>
      [0, 1, 2, 3].map((i) => (ref) => {
        emojiRefs.current[i] = ref ?? null;
        emojiRefsChanged.current.call(undefined);
      }),
    []
  );

  // Manages the emoji animation when a response is selected
  useEffect(() => {
    let active = true;
    let canceled = new Callbacks<undefined>();
    let animations: { rotation: BezierAnimation[]; scale: BezierAnimation[] } | null = null;
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

      responseChanged.current.add(onResponseChanged);
      emojiRefsChanged.current.add(onEmojiRefsChanged);

      canceled.add(() => {
        responseChanged.current.remove(onResponseChanged);
        emojiRefsChanged.current.remove(onEmojiRefsChanged);
      });
    }

    function onResponseChanged() {
      clearStyles();

      if (currentResponse.current === null) {
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

    function onEmojiRefsChanged() {
      clearStyles();
    }

    function clearStyles() {
      const newRefs = emojiRefs.current;
      for (let i = 0; i < newRefs.length; i++) {
        newRefs[i]?.removeAttribute('style');
      }
    }

    function onFrame(now: DOMHighResTimeStamp) {
      if (!active || animations === null || currentResponse.current === null) {
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

      const div = emojiRefs.current[currentResponse.current - 1];
      if (div === null) {
        requestAnimationFrame(onFrame);
        return;
      }

      const rotation =
        animations.rotation.length === 0 ? 0 : calculateAnimValue(animations.rotation[0], now);
      const scale =
        animations.scale.length === 0 ? 1 : calculateAnimValue(animations.scale[0], now);
      div.style.transform = `rotate(${rotation}deg) scale(${scale})`;
      requestAnimationFrame(onFrame);
    }
  }, []);

  const storeResponse = useCallback(async () => {
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
  }, [loginContext, response, journey.uid, journey.jwt]);

  const onX = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      storeResponse();
      setScreen('post', true);
    },
    [setScreen, storeResponse]
  );

  const onContinue = onX;

  const classNameForResponse = (resp: number): string | undefined =>
    combineClasses(styles.answer, response === resp ? styles.selected : undefined);

  const clickResponse = useMemo<((e: React.MouseEvent<HTMLButtonElement>) => void)[]>(
    () =>
      [1, 2, 3, 4].map((i) => (e) => {
        e.preventDefault();
        setResponse(i);
      }),
    []
  );

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...shared.blurredImage!} />
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
              <button className={classNameForResponse(1)} onClick={clickResponse[0]}>
                <div className={styles.answerEmoji} ref={setEmojiRefs[0]}>
                  😍
                </div>
                <div className={styles.answerText}>Loved</div>
              </button>
              <button className={classNameForResponse(2)} onClick={clickResponse[1]}>
                <div className={styles.answerEmoji} ref={setEmojiRefs[1]}>
                  😌
                </div>
                <div className={styles.answerText}>Liked</div>
              </button>
              <button className={classNameForResponse(3)} onClick={clickResponse[2]}>
                <div className={styles.answerEmoji} ref={setEmojiRefs[2]}>
                  😕
                </div>
                <div className={styles.answerText}>Disliked</div>
              </button>
              <button className={classNameForResponse(4)} onClick={clickResponse[3]}>
                <div className={styles.answerEmoji} ref={setEmojiRefs[3]}>
                  👿
                </div>
                <div className={styles.answerText}>Hated</div>
              </button>
            </div>
          </div>
          <div className={styles.continueContainer}>
            <Button
              type="button"
              variant={response === null ? 'link-white' : 'filled-white'}
              onClick={onContinue}
              fullWidth>
              {response === null ? 'Skip' : 'Continue'}
            </Button>
            <div className={styles.infoText}>
              Your ratings will be used to personalize your experience
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
