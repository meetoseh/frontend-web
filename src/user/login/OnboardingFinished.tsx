import { ReactElement, useEffect, useMemo, useRef } from 'react';
import { Button } from '../../shared/forms/Button';
import { useFullHeightStyle } from '../../shared/hooks/useFullHeight';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { OsehImageFromState, OsehImageProps, useOsehImageState } from '../../shared/OsehImage';
import styles from './OnboardingFinished.module.css';
import { interpolateColor, interpolateNumber } from '../../shared/lib/BezierAnimation';
import { Bezier, ease } from '../../shared/lib/Bezier';
import badgeStart from './icons/badgeStart.svg';
import badgeEnd from './icons/badgeEnd.svg';
import enlightenmentStart from './icons/enlightenmentStart.svg';
import enlightenmentEnd from './icons/enlightenmentEnd.svg';
import { ImageCrossFade } from '../../shared/anim/ImageCrossFade';
import { useSimpleAnimation } from '../../shared/hooks/useSimpleAnimation';

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
const secondAnimDelay = 750;

type FirstClassWithAnimationRefs = {
  step: HTMLDivElement;
  sep: HTMLDivElement;
};

type FirstClassWithAnimationState = {
  duration: number;
  ease: Bezier;
};

const firstClassAnimation = {
  initialize: (refs: FirstClassWithAnimationRefs): FirstClassWithAnimationState => {
    refs.sep.removeAttribute('style');
    refs.step.removeAttribute('style');

    return { duration: animDuration, ease };
  },
  render: (
    refs: FirstClassWithAnimationRefs,
    state: FirstClassWithAnimationState,
    animationTime: number
  ) => {
    const bkndProgress = state.ease.b_t(Math.min(1, animationTime / state.duration))[1];
    const bkndStartColor: [number, number, number, number] = [68, 98, 102, 0.4];
    const bkndEndColor: [number, number, number, number] = [52, 126, 122, 1.0];

    const bkndColor = interpolateColor(bkndStartColor, bkndEndColor, bkndProgress);
    const bkndOpacity = interpolateNumber(bkndStartColor[3], bkndEndColor[3], bkndProgress);

    const bknd = `rgba(${bkndColor[0]}, ${bkndColor[1]}, ${bkndColor[2]}, ${bkndOpacity})`;
    refs.step.style.background = bknd;
    refs.sep.style.background = bknd;
  },
  tick: (
    refs: FirstClassWithAnimationRefs,
    state: FirstClassWithAnimationState,
    animationTime: number
  ) => {
    return animationTime < state.duration;
  },
  dispose: (refs: FirstClassWithAnimationRefs, state: FirstClassWithAnimationState) => {},
};

const FirstClassWithAnimation = ({ paused }: { paused: boolean }): ReactElement => {
  const stepRef = useRef<HTMLDivElement>(null);
  const sepRef = useRef<HTMLDivElement>(null);

  const refs = useRef<FirstClassWithAnimationRefs>();
  useEffect(() => {
    if (stepRef.current === null || sepRef.current === null) {
      refs.current = undefined;
    } else if (
      refs.current === undefined ||
      refs.current.step !== stepRef.current ||
      refs.current.sep !== sepRef.current
    ) {
      refs.current = { step: stepRef.current, sep: sepRef.current };
    }
  });

  useSimpleAnimation({
    ref: refs,
    delay: animDelay,
    paused,
    ...firstClassAnimation,
  });

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

type EnlightenmentState = {
  duration: number;
  ease: Bezier;
};

const enlightenmentAnimation = {
  initialize: (ref: HTMLDivElement): EnlightenmentState => {
    ref.removeAttribute('style');
    ref.style.borderWidth = '1px';
    ref.style.borderStyle = 'dashed';
    ref.style.borderColor = 'transparent';

    return { duration: animDuration, ease };
  },
  render: (ref: HTMLDivElement, state: EnlightenmentState, animationTime: number) => {
    const borderProgress = state.ease.b_t(Math.min(1, animationTime / state.duration))[1];
    ref.style.borderColor = `rgba(255, 255, 255, ${borderProgress})`;
  },
  tick: (ref: HTMLDivElement, state: EnlightenmentState, animationTime: number) => {
    return animationTime < state.duration;
  },
  dispose: (ref: HTMLDivElement, state: EnlightenmentState) => {},
};

const EnlightenmentWithAnimation = ({ paused }: { paused: boolean }): ReactElement => {
  const stepRef = useRef<HTMLDivElement>(null);

  useSimpleAnimation({
    ref: stepRef,
    delay: secondAnimDelay,
    paused,
    ...enlightenmentAnimation,
  });

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
