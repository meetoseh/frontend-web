import { CSSProperties, ReactElement, useEffect, useRef } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { GotoEmotionResources } from './GotoEmotionResources';
import { GotoEmotionState } from './GotoEmotionState';
import styles from './GotoEmotion.module.css';
import { IconButton } from '../../../../shared/forms/IconButton';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ProfilePictures } from '../../../interactive_prompt/components/ProfilePictures';
import { Button } from '../../../../shared/forms/Button';
import { useDynamicAnimationEngine } from '../../../../shared/anim/useDynamicAnimation';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ease, easeOutBack } from '../../../../shared/lib/Bezier';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useStyleVWC } from '../../../../shared/hooks/useStyleVWC';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';

/**
 * Allows the user to start a class within a given emotion, or go back to
 * their home screen.
 */
export const GotoEmotion = ({
  state,
  resources,
}: FeatureComponentProps<GotoEmotionState, GotoEmotionResources>): ReactElement => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  const startedAnim = useRef(false);
  const backButtonOpacityVWC = useWritableValueWithCallbacks(() => 0);
  const titleOpacityVWC = useWritableValueWithCallbacks(() => 0);
  const realEmotionOpacityVWC = useWritableValueWithCallbacks(() => 0);
  const socialProofOpacityVWC = useWritableValueWithCallbacks(() => 0);
  const oneMinuteButtonOpacityVWC = useWritableValueWithCallbacks(() => 0);
  const longerClassButtonOpacityVWC = useWritableValueWithCallbacks(() => 0);
  const holdoverEmotionWordOpacityVWC = useWritableValueWithCallbacks(() => 1);
  const holdoverEmotionMoveProgressVWC = useWritableValueWithCallbacks(() => 0);
  const engine = useDynamicAnimationEngine();

  useEffect(() => {
    if (startedAnim.current) {
      return;
    }
    startedAnim.current = true;

    const show = state.get().show;
    if (show?.animationHints === undefined) {
      setVWC(holdoverEmotionMoveProgressVWC, 1);
      setVWC(holdoverEmotionWordOpacityVWC, 0);
      engine.play([
        {
          id: 'fadeIn',
          duration: 350,
          progressEase: { type: 'bezier', bezier: ease },
          onFrame: (progress) => {
            setVWC(backButtonOpacityVWC, progress);
            setVWC(oneMinuteButtonOpacityVWC, progress);
            setVWC(longerClassButtonOpacityVWC, progress);
            setVWC(titleOpacityVWC, progress);
            setVWC(realEmotionOpacityVWC, progress);
            setVWC(socialProofOpacityVWC, progress);
          },
        },
      ]);
      return;
    }

    engine.play([
      {
        id: 'move',
        duration: 1500,
        progressEase: {
          type: 'bezier',
          bezier: easeOutBack,
        },
        onFrame: (progress) => {
          setVWC(holdoverEmotionMoveProgressVWC, progress);
        },
      },
      {
        id: 'fadeIn',
        duration: 600,
        delayUntil: { type: 'relativeToEnd', id: 'move', after: 0 },
        progressEase: { type: 'bezier', bezier: ease },
        onFrame: (progress) => {
          setVWC(backButtonOpacityVWC, progress);
          setVWC(oneMinuteButtonOpacityVWC, progress);
          setVWC(longerClassButtonOpacityVWC, progress);
          setVWC(titleOpacityVWC, progress);
          setVWC(realEmotionOpacityVWC, progress);
          setVWC(socialProofOpacityVWC, progress);
          setVWC(holdoverEmotionWordOpacityVWC, 1 - progress);
        },
      },
    ]);
  });

  const backButtonRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const backButtonStyleVWC = useMappedValueWithCallbacks(backButtonOpacityVWC, (opacity) => ({
    opacity: `${opacity}`,
  }));
  useStyleVWC(backButtonRef, backButtonStyleVWC);

  const titleRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const titleStyleVWC = useMappedValueWithCallbacks(titleOpacityVWC, (opacity) => ({
    opacity: `${opacity}`,
  }));
  useStyleVWC(titleRef, titleStyleVWC);

  const realEmotionRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const realEmotionStyleVWC = useMappedValueWithCallbacks(realEmotionOpacityVWC, (opacity) => ({
    opacity: `${opacity}`,
  }));
  useStyleVWC(realEmotionRef, realEmotionStyleVWC);

  const realEmotionLocationVWC = useWritableValueWithCallbacks<{
    top: number;
    right: number;
    bottom: number;
    left: number;
  } | null>(() => null);
  useValueWithCallbacksEffect(realEmotionRef, (rUnch) => {
    if (rUnch === null) {
      return;
    }
    const r = rUnch;
    const bounds = r.getBoundingClientRect();
    setVWC(realEmotionLocationVWC, {
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      left: bounds.left,
    });

    let active = true;
    requestAnimationFrame(testSize);

    let expected = bounds;
    return () => {
      active = false;
    };

    function testSize() {
      if (!active) {
        return;
      }

      if (startedAnim.current && !engine.playing.get()) {
        return;
      }

      const newBounds = r.getBoundingClientRect();
      if (newBounds.left !== expected.left || newBounds.top !== expected.top) {
        expected = newBounds;
        setVWC(realEmotionLocationVWC, {
          top: newBounds.top,
          right: newBounds.right,
          bottom: newBounds.bottom,
          left: newBounds.left,
        });
      }

      requestAnimationFrame(testSize);
    }
  });

  const socialProofRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const socialProofStyleVWC = useMappedValueWithCallbacks(socialProofOpacityVWC, (opacity) => ({
    opacity: `${opacity}`,
  }));
  useStyleVWC(socialProofRef, socialProofStyleVWC);

  const oneMinuteButtonRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const oneMinuteButtonStyleVWC = useMappedValueWithCallbacks(
    oneMinuteButtonOpacityVWC,
    (opacity) => ({ opacity: `${opacity}` })
  );
  useStyleVWC(oneMinuteButtonRef, oneMinuteButtonStyleVWC);

  const longerClassButtonRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const longerClassStyleVWC = useMappedValueWithCallbacks(
    longerClassButtonOpacityVWC,
    (opacity) => ({
      opacity: `${opacity}`,
    })
  );
  useStyleVWC(longerClassButtonRef, longerClassStyleVWC);

  const holdoverEmotionWordRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const holdoverEmotionWordStyleVWC = useMappedValuesWithCallbacks(
    [holdoverEmotionWordOpacityVWC, state, realEmotionLocationVWC, holdoverEmotionMoveProgressVWC],
    (): CSSProperties => {
      const hints = state.get().show?.animationHints;
      if (hints === undefined) {
        return { display: 'none' };
      }

      const opacity = holdoverEmotionWordOpacityVWC.get();

      const start = hints.emotionStart;

      const startPaddingHorizontal = 18;
      const endPaddingHorizontal = 0;

      const startPaddingVertical = 24;
      const endPaddingVertical = 0;

      const endRect = realEmotionLocationVWC.get();
      if (endRect === null) {
        return {
          display: 'block',
          opacity: `${opacity}`,
          left: `${start.left}px`,
          top: `${start.top}px`,
          padding: `${startPaddingVertical}px ${startPaddingHorizontal}px`,
        };
      }

      const startFontSize = 16;
      const endFontSize = 28;

      const startLineHeight = 24;
      const endLineHeight = 39;

      const endLeft = endRect.left;
      const endTop = endRect.top;

      const moveProg = holdoverEmotionMoveProgressVWC.get();
      const left = start.left + (endLeft - start.left) * moveProg;
      const top = start.top + (endTop - start.top) * moveProg;
      const fontSize = startFontSize + (endFontSize - startFontSize) * moveProg;
      const paddingHorizontal =
        startPaddingHorizontal + (endPaddingHorizontal - startPaddingHorizontal) * moveProg;
      const paddingVertical =
        startPaddingVertical + (endPaddingVertical - startPaddingVertical) * moveProg;
      const lineHeight = startLineHeight + (endLineHeight - startLineHeight) * moveProg;
      return {
        display: opacity === 0 ? 'none' : 'block',
        opacity: `${opacity}`,
        left: `${left}px`,
        top: `${top}px`,
        fontSize: `${fontSize}px`,
        padding: `${paddingVertical}px ${paddingHorizontal}px`,
        lineHeight: `${lineHeight}px`,
      };
    }
  );
  useStyleVWC(holdoverEmotionWordRef, holdoverEmotionWordStyleVWC);

  const emotionWordVWC = useMappedValueWithCallbacks(state, (s) => s.show?.emotion?.word ?? '');

  const containerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const containerStyleVWC = useMappedValueWithCallbacks(windowSizeVWC, (size) => ({
    width: `${size.width}px`,
    height: `${size.height}px`,
  }));
  useStyleVWC(containerRef, containerStyleVWC);

  return (
    <div
      className={styles.container}
      style={containerStyleVWC.get()}
      ref={(r) => setVWC(containerRef, r)}>
      <div className={styles.background} />
      <div className={styles.foreground}>
        <div
          className={styles.backButton}
          style={backButtonStyleVWC.get()}
          ref={(r) => setVWC(backButtonRef, r)}>
          <IconButton
            icon={styles.iconBack}
            srOnlyName="Back"
            onClick={(e) => {
              e.preventDefault();
              resources.get().onBack();
            }}
          />
        </div>
        <div className={styles.content}>
          <div
            className={styles.title}
            style={titleStyleVWC.get()}
            ref={(r) => setVWC(titleRef, r)}>
            You want to feel
          </div>
          <RenderGuardedComponent
            props={emotionWordVWC}
            component={(word) => (
              <div
                className={styles.emotion}
                style={realEmotionStyleVWC.get()}
                ref={(r) => setVWC(realEmotionRef, r)}>
                {word}
              </div>
            )}
          />
          <div
            className={styles.socialProof}
            style={socialProofStyleVWC.get()}
            ref={(r) => setVWC(socialProofRef, r)}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(
                resources,
                (r) => r.freeEmotionJourney.result?.numVotes ?? 0
              )}
              component={(votes) => (
                <div className={styles.socialProofMessage}>
                  {votes.toLocaleString()} others also chose this today
                </div>
              )}
            />
            <div className={styles.socialProofPictures}>
              <ProfilePictures
                profilePictures={useMappedValueWithCallbacks(resources, (r) => ({
                  pictures: r.socialProofPictures,
                  additionalUsers: 0,
                }))}
                hereSettings={{ type: 'none' }}
                center
                size="24px"
              />
            </div>
          </div>
        </div>
        <div className={styles.buttons}>
          <div
            className={styles.button}
            style={oneMinuteButtonStyleVWC.get()}
            ref={(r) => setVWC(oneMinuteButtonRef, r)}>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(
                resources,
                (r) => r.freeEmotionJourney.type === 'loading'
              )}
              component={(spinner) => (
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    resources.get().onTakeFreeJourney();
                  }}
                  variant="filled-white"
                  disabled={spinner}
                  spinner={spinner}
                  fullWidth>
                  Take a 1-minute Class
                </Button>
              )}
            />
          </div>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(resources, (r) => ({
              spinner: r.havePro.type === 'loading',
              show:
                r.havePro.type === 'loading' ||
                (r.havePro.type === 'success' && !r.havePro.result) ||
                (r.premiumEmotionJourney.type !== 'unavailable' &&
                  r.premiumEmotionJourney.type !== 'load-prevented'),
            }))}
            component={({ spinner, show }) =>
              !show ? (
                <></>
              ) : (
                <div
                  className={styles.button}
                  style={longerClassStyleVWC.get()}
                  ref={(r) => setVWC(longerClassButtonRef, r)}>
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      resources.get().onTakePremiumJourney();
                    }}
                    variant="filled-premium"
                    disabled={spinner}
                    spinner={spinner}
                    fullWidth>
                    Take a Longer Class
                  </Button>
                </div>
              )
            }
          />
        </div>
      </div>

      <RenderGuardedComponent
        props={emotionWordVWC}
        component={(word) => (
          <div
            className={styles.holdoverEmotion}
            style={holdoverEmotionWordStyleVWC.get()}
            ref={(r) => setVWC(holdoverEmotionWordRef, r)}>
            {word}
          </div>
        )}
      />
    </div>
  );
};
