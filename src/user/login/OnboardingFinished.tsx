import { MutableRefObject, ReactElement, useEffect, useMemo, useRef } from 'react';
import { Button } from '../../shared/forms/Button';
import { useFullHeightStyle } from '../../shared/hooks/useFullHeight';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImageFromState, OsehImageProps, useOsehImageState } from '../../shared/OsehImage';
import styles from './OnboardingFinished.module.css';
import { Callbacks } from '../../shared/lib/Callbacks';
import { createCancelablePromiseFromCallbacks } from '../../shared/lib/createCancelablePromiseFromCallbacks';
import {
  BezierAnimation,
  animIsComplete,
  calculateAnimValue,
  interpolateColor,
  interpolateNumber,
} from '../../shared/lib/BezierAnimation';
import { ease } from '../../shared/lib/Bezier';
import badgeStart from './icons/badgeStart.svg';
import badgeEnd from './icons/badgeEnd.svg';
import enlightenmentStart from './icons/enlightenmentStart.svg';
import enlightenmentEnd from './icons/enlightenmentEnd.svg';
import { ImageCrossFade } from '../../shared/anim/ImageCrossFade';
import { createCancelableTimeout } from '../../shared/lib/createCancelableTimeout';

type OnboardingFinishedProps = {
  /**
   * True to delay animations, usually used when this isn't on the screen yet.
   */
  paused?: boolean;

  /**
   * The function to call to return the user to the home screen.
   */
  onFinished: () => void;
};

/**
 * The screen that is shown when the user has finished the onboarding experience.
 */
export const OnboardingFinished = ({
  paused,
  onFinished,
}: OnboardingFinishedProps): ReactElement => {
  const windowSize = useWindowSize();
  const backgroundProps = useMemo<OsehImageProps>(
    () => ({
      uid: 'oseh_if_0ykGW_WatP5-mh-0HRsrNw',
      jwt: null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
      isPublic: true,
      placeholderColor: '#223a3e',
    }),
    [windowSize.width, windowSize.height]
  );
  const background = useOsehImageState(backgroundProps);
  const containerStyle = useFullHeightStyle({ windowSize });

  return (
    <div className={styles.container} style={containerStyle}>
      <div className={styles.backgroundContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.contentContainer}>
        <div className={styles.titleAndJourney}>
          <div className={styles.title}>Your Mindfulness Journey</div>
          <div className={styles.journey}>
            <FirstClassWithAnimation paused={paused ?? false} />
            <div className={styles.step}>
              <div className={styles.stepIconContainer}>
                <div className={styles.calendar}></div>
              </div>
              <div className={styles.stepText}>Come back tomorrow for a new class</div>
            </div>
            <div className={styles.smallStepSeparator}></div>
            <div className={styles.step}>
              <div className={styles.stepIconContainer}>
                <div className={styles.stars}></div>
              </div>
              <div className={styles.stepText}>Hit a 7-day streak</div>
            </div>
            <div className={styles.largeStepSeparator}></div>
            <EnlightenmentWithAnimation paused={paused ?? false} />
          </div>
        </div>
        <div className={styles.continueContainer}>
          <Button type="button" fullWidth variant="filled" onClick={onFinished}>
            Try Another Class
          </Button>
        </div>
      </div>
    </div>
  );
};

const animDuration = 500;
const animDelay = 250;
const secondAnimDelay = 2500;

const FirstClassWithAnimation = ({ paused }: { paused: boolean }): ReactElement => {
  const stepRef = useRef<HTMLDivElement>(null);
  const sepRef = useRef<HTMLDivElement>(null);
  const running = useRef<boolean>(false);
  const runningCallbacks = useRef<Callbacks<undefined>>() as MutableRefObject<Callbacks<undefined>>;

  if (runningCallbacks.current === undefined) {
    runningCallbacks.current = new Callbacks<undefined>();
  }

  useEffect(() => {
    if (stepRef.current === null || sepRef.current === null || paused) {
      return;
    }

    const step = stepRef.current;
    const sep = sepRef.current;

    const cancelers = new Callbacks<undefined>();
    let active = true;
    const unmount = () => {
      if (!active) {
        return;
      }

      active = false;
      cancelers.call(undefined);
    };
    handleAnimation();
    return unmount;

    async function handleAnimation() {
      while (running.current) {
        if (!active) {
          return;
        }
        const lastEffectPromise = createCancelablePromiseFromCallbacks(runningCallbacks.current);
        const canceledPromise = createCancelablePromiseFromCallbacks(cancelers);
        await Promise.race([lastEffectPromise.promise, canceledPromise.promise]);
        lastEffectPromise.cancel();
        canceledPromise.cancel();
      }
      running.current = true;

      try {
        resetState();
      } catch (e) {
        running.current = false;
        runningCallbacks.current.call(undefined);
        throw e;
      }

      const startDelay = createCancelableTimeout(animDelay);
      const canceled = createCancelablePromiseFromCallbacks(cancelers);
      await Promise.race([startDelay.promise, canceled.promise]);
      startDelay.cancel();
      canceled.cancel();
      if (!active) {
        running.current = false;
        runningCallbacks.current.call(undefined);
        return;
      }

      render(0);
      playAnimation();
    }

    function resetState() {
      step.removeAttribute('style');
    }

    function render(bkndProgress: number) {
      const bkndStartColor: [number, number, number, number] = [68, 98, 102, 0.4];
      const bkndEndColor: [number, number, number, number] = [52, 126, 122, 1.0];

      const bkndColor = interpolateColor(bkndStartColor, bkndEndColor, bkndProgress);
      const bkndOpacity = interpolateNumber(bkndStartColor[3], bkndEndColor[3], bkndProgress);

      const bknd = `rgba(${bkndColor[0]}, ${bkndColor[1]}, ${bkndColor[2]}, ${bkndOpacity})`;
      step.style.background = bknd;
      sep.style.background = bknd;
    }

    function playAnimation() {
      const bkndProgressAnimation: BezierAnimation = {
        from: 0,
        to: 1,
        startedAt: null,
        ease,
        duration: animDuration,
      };

      const onFrame = (now: DOMHighResTimeStamp) => {
        if (!active) {
          running.current = false;
          runningCallbacks.current.call(undefined);
          return;
        }

        const bkndDone = animIsComplete(bkndProgressAnimation, now);

        if (bkndDone) {
          cancelers.add(() => {
            running.current = false;
            runningCallbacks.current.call(undefined);
          });
          return;
        }

        const bkndProgress = bkndDone ? 1 : calculateAnimValue(bkndProgressAnimation, now);

        render(bkndProgress);
        requestAnimationFrame(onFrame);
      };

      requestAnimationFrame(onFrame);
    }
  }, [paused]);

  return (
    <>
      <div ref={stepRef} className={styles.step}>
        <div className={styles.stepIconContainer}>
          <ImageCrossFade
            from={badgeStart}
            to={badgeEnd}
            duration={animDuration}
            width={42}
            height={42}
            delay={animDelay}
            paused={paused}
          />
        </div>
        <div className={styles.stepText}>Complete your first class</div>
      </div>
      <div className={styles.smallStepSeparator} ref={sepRef}></div>
    </>
  );
};

const EnlightenmentWithAnimation = ({ paused }: { paused: boolean }): ReactElement => {
  const stepRef = useRef<HTMLDivElement>(null);

  const running = useRef<boolean>(false);
  const runningCallbacks = useRef<Callbacks<undefined>>() as MutableRefObject<Callbacks<undefined>>;

  if (runningCallbacks.current === undefined) {
    runningCallbacks.current = new Callbacks();
  }

  useEffect(() => {
    if (stepRef.current === null || paused) {
      return;
    }

    const step = stepRef.current;
    const cancelers = new Callbacks<undefined>();
    let active = true;

    acquireLockAndPlayAnimation();
    return () => {
      active = false;
      cancelers.call(undefined);
    };

    async function playAnimation() {
      resetState();

      const startDelay = createCancelableTimeout(secondAnimDelay);
      const canceled = createCancelablePromiseFromCallbacks(cancelers);
      await Promise.race([startDelay.promise, canceled.promise]);
      startDelay.cancel();
      canceled.cancel();

      if (!active) {
        running.current = false;
        runningCallbacks.current.call(undefined);
        return;
      }

      render(0);

      const borderProgressAnimation: BezierAnimation = {
        from: 0,
        to: 1,
        startedAt: null,
        ease,
        duration: animDuration,
      };

      const onFrame = (now: DOMHighResTimeStamp) => {
        if (!active) {
          running.current = false;
          runningCallbacks.current.call(undefined);
          return;
        }

        const borderProgressDone = animIsComplete(borderProgressAnimation, now);
        const borderProgress = borderProgressDone
          ? 1
          : calculateAnimValue(borderProgressAnimation, now);

        render(borderProgress);

        if (borderProgressDone) {
          cancelers.add(() => {
            running.current = false;
            runningCallbacks.current.call(undefined);
          });
          return;
        }

        requestAnimationFrame(onFrame);
      };

      requestAnimationFrame(onFrame);
    }

    function resetState() {
      step.removeAttribute('style');
      step.style.borderWidth = '1px';
      step.style.borderStyle = 'dashed';
      step.style.borderColor = 'transparent';
    }

    function render(borderProgress: number) {
      step.style.borderColor = `rgba(255, 255, 255, ${borderProgress})`;
    }

    async function acquireLockAndPlayAnimation() {
      while (running.current) {
        if (!active) {
          return;
        }

        const canceled = createCancelablePromiseFromCallbacks(cancelers);
        const prevUnmounted = createCancelablePromiseFromCallbacks(runningCallbacks.current);
        await Promise.race([canceled.promise, prevUnmounted.promise]);
        canceled.cancel();
        prevUnmounted.cancel();
      }

      running.current = true;
      playAnimation();
    }
  }, [paused]);

  return (
    <div className={styles.step} ref={stepRef}>
      <div className={styles.stepIconContainer}>
        <ImageCrossFade
          from={enlightenmentStart}
          to={enlightenmentEnd}
          duration={animDuration}
          width={42}
          height={42}
          delay={secondAnimDelay}
          paused={paused}
        />
      </div>
      <div className={styles.stepText}>Achieve enlightenment</div>
    </div>
  );
};
