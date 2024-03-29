import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { HomeScreenResources } from './HomeScreenResources';
import { HomeScreenState } from './HomeScreenState';
import styles from './HomeScreen.module.css';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { MyProfilePicture } from '../../../../shared/components/MyProfilePicture';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { BottomNavBar } from '../../../bottomNav/BottomNavBar';
import { Emotion } from '../pickEmotionJourney/Emotion';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { DAYS_OF_WEEK } from '../../../../shared/models/DayOfWeek';
import { VisualGoal, VisualGoalState } from './components/VisualGoal';
import { useAnimationTargetAndRendered } from '../../../../shared/anim/useAnimationTargetAndRendered';
import { ease } from '../../../../shared/lib/Bezier';
import { BezierAnimator, TrivialAnimator } from '../../../../shared/anim/AnimationLoop';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { useDynamicAnimationEngine } from '../../../../shared/anim/useDynamicAnimation';
import { useStyleVWC } from '../../../../shared/hooks/useStyleVWC';

/**
 * Displays the home screen for the user
 */
export const HomeScreen = ({
  state,
  resources,
  tutorial,
}: FeatureComponentProps<HomeScreenState, HomeScreenResources> & {
  tutorial?: {
    step: ValueWithCallbacks<'explain_top' | 'explain_bottom'>;
    onNextStep: () => void;
  };
}): ReactElement => {
  const currentDate = useMemo(() => new Date(), []);
  const greeting = useMemo(() => {
    const hour = currentDate.getHours();
    if (hour >= 3 && hour < 12) {
      return <>Good Morning</>;
    } else if (hour >= 12 && hour < 17) {
      return <>Good Afternoon</>;
    } else {
      return <>Good Evening</>;
    }
  }, [currentDate]);
  const loginContextRaw = useContext(LoginContext);
  const nameVWC = useMappedValueWithCallbacks(loginContextRaw.value, (loginContextUnch) => {
    if (loginContextUnch.state !== 'logged-in') {
      return <></>;
    }
    const loginContext = loginContextUnch;
    const name = loginContext.userAttributes.givenName;
    if (name === null || name.toLowerCase() === 'anonymous' || name.toLowerCase() === 'there') {
      return <></>;
    }
    if (name.startsWith('Guest-')) {
      return <>, Guest</>;
    }
    return <>, {loginContext.userAttributes.givenName}</>;
  });

  const backgroundImageVWC = useMappedValueWithCallbacks(resources, (r) => r.backgroundImage);
  const headerAndGoalRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useStyleVWC(
    headerAndGoalRef,
    useMappedValueWithCallbacks(backgroundImageVWC, (bknd) => ({
      minHeight: `${bknd.displayHeight}px`,
    }))
  );

  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  const estimatedEmotionsHeightVWC = useMappedValuesWithCallbacks(
    [windowSizeVWC, backgroundImageVWC],
    () => {
      const windowSize = windowSizeVWC.get();
      const backgroundImage = backgroundImageVWC.get();

      return (
        windowSize.height -
        backgroundImage.displayHeight -
        28 /* question <-> bknd margin */ -
        24 /* question */ -
        28 /* question <-> emotion margin */ -
        24 /* emotion <-> bottom nav margin */ -
        67 /* bottom nav */
      );
    }
  );

  const emotionsRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const emotionsHeightVWC = useWritableValueWithCallbacks<number>(() =>
    estimatedEmotionsHeightVWC.get()
  );

  useValuesWithCallbacksEffect([emotionsRef, estimatedEmotionsHeightVWC], () => {
    const eleRaw = emotionsRef.get();
    if (eleRaw === null) {
      setVWC(emotionsHeightVWC, estimatedEmotionsHeightVWC.get());
      return undefined;
    }

    const ele = eleRaw;
    let active = true;
    const cancelers = new Callbacks<undefined>();

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (!active) {
          ro.disconnect();
          return;
        }

        setVWC(emotionsHeightVWC, ele.offsetHeight);
      });
      ro.observe(ele);

      cancelers.add(() => {
        ro.disconnect();
      });
    } else {
      const onResize = () => {
        if (!active) {
          window.removeEventListener('resize', onResize);
          return;
        }

        setVWC(emotionsHeightVWC, ele.offsetHeight);
      };
      window.addEventListener('resize', onResize);
      cancelers.add(() => {
        window.removeEventListener('resize', onResize);
      });
    }
    setVWC(emotionsHeightVWC, ele.offsetHeight);
    return () => {
      active = false;
      cancelers.call(undefined);
    };
  });

  const numberOfEmotionRowsVWC = useMappedValueWithCallbacks(emotionsHeightVWC, (h) =>
    Math.min(4, Math.floor(h / 76))
  );
  const emotionsVWC = useMappedValueWithCallbacks(resources, (r) => r.emotions.result ?? [], {
    outputEqualityFn: (a, b) => a.length === b.length && a.every((v, i) => v.word === b[i].word),
  });
  const emotionRowsVWC = useMappedValuesWithCallbacks(
    [emotionsVWC, numberOfEmotionRowsVWC],
    (): Emotion[][] => {
      const emotions = emotionsVWC.get();
      const rows = numberOfEmotionRowsVWC.get();

      const numPerRow = Math.ceil(emotions.length / rows);
      if (numPerRow === 0) {
        return [];
      }

      const result: Emotion[][] = [];
      for (let i = 0; i < rows; i++) {
        result.push(emotions.slice(i * numPerRow, (i + 1) * numPerRow));
      }

      // iteratively fix jumps of 2 or more by moving emotions
      // from earlier rows to later rows; this has to end at
      // some point because each step moves an emotion from row
      // i to i+1, and this can only occur at most the number of
      // rows - 1 time per emotion, and there are finitely many
      // emotions. in practice, it usually does at most 1 iteration
      while (true) {
        let foundImprovement = false;
        for (let i = 0; i < rows - 1; i++) {
          if (result[i].length - result[i + 1].length > 1) {
            const toMove = result[i].pop()!;
            result[i + 1].unshift(toMove);
            foundImprovement = true;
          }
        }
        if (!foundImprovement) {
          break;
        }
      }

      return result;
    }
  );

  useValuesWithCallbacksEffect([emotionRowsVWC, emotionsRef, windowSizeVWC], () => {
    const eleRaw = emotionsRef.get();
    if (eleRaw === null) {
      return;
    }
    const ele = eleRaw;

    let active = true;
    const cancelers = new Callbacks<undefined>();

    if (emotionsVWC.get().length === ele.children.length) {
      doAdjust();
    }
    {
      let req: number | undefined = undefined;
      const onFrame = () => {
        req = undefined;
        if (!active) {
          return;
        }
        if (!doAdjust()) {
          req = requestAnimationFrame(onFrame);
        }
      };
      req = requestAnimationFrame(onFrame);
      cancelers.add(() => {
        if (req !== undefined) {
          cancelAnimationFrame(req);
          req = undefined;
        }
      });
    }
    return () => {
      active = false;
      cancelers.call(undefined);
    };

    function doAdjust() {
      if (!active) {
        return true;
      }

      const rows = emotionRowsVWC.get();
      if (ele.children.length !== rows.length) {
        return false;
      }

      const size = windowSizeVWC.get();
      for (let i = 0; i < rows.length; i++) {
        const row = ele.children[i] as HTMLDivElement;
        if (row.scrollWidth > row.clientWidth) {
          row.scrollTo({ left: (row.scrollWidth - size.width) / 2 });
        }
      }
      return true;
    }
  });

  const streakInfoVWC = useMappedValueWithCallbacks(state, (s) => s.streakInfo);
  const visualGoalStateVWC = useAnimationTargetAndRendered<VisualGoalState>(
    () => ({
      filled: 0,
      goal: streakInfoVWC.get().result?.goalDaysPerWeek ?? 3,
    }),
    () => [
      new BezierAnimator(
        ease,
        350,
        (p) => p.filled,
        (p, v) => (p.filled = v)
      ),
      new TrivialAnimator('goal'),
    ]
  );

  const bottomNavRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const bottomNavHeightVWC = useWritableValueWithCallbacks<number>(() => 67);

  useValueWithCallbacksEffect(bottomNavRef, (ele) => {
    if (ele !== null) {
      setVWC(bottomNavHeightVWC, ele.offsetHeight);
    }
    return undefined;
  });

  useValueWithCallbacksEffect(streakInfoVWC, (streakInfo) => {
    setVWC(
      visualGoalStateVWC.target,
      {
        filled: streakInfo.result?.daysOfWeek.length ?? 0,
        goal: streakInfo.result?.goalDaysPerWeek ?? 3,
      },
      (a, b) => a.filled === b.filled && a.goal === b.goal
    );
    return undefined;
  });
  const overlayVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const overlayStyleVWC = useMappedValuesWithCallbacks(
    [...(tutorial === undefined ? [] : [tutorial.step]), backgroundImageVWC, bottomNavHeightVWC],
    () => {
      const step = tutorial?.step?.get();
      if (step === undefined) {
        return {};
      }

      const imgHeight = backgroundImageVWC.get();
      const botNavHeight = bottomNavHeightVWC.get();

      if (step === 'explain_bottom') {
        return { top: '0', bottom: 'unset', height: `${imgHeight.displayHeight}px` };
      } else {
        return {
          top: `${imgHeight.displayHeight}px`,
          bottom: `${botNavHeight}px`,
          height: 'unset',
        };
      }
    }
  );

  useStyleVWC(overlayVWC, overlayStyleVWC);

  const bkndImageSlideOutProgressVWC = useWritableValueWithCallbacks<number>(() => 0);
  const bottomNavSlideOutProgressVWC = useWritableValueWithCallbacks<number>(() => 0);
  const selectingEmotionVWC = useWritableValueWithCallbacks<Emotion | null>(() => null);
  const irrelevantOpacityVWC = useWritableValueWithCallbacks<number>(() => 1);
  const selectingEmotionOpacityVWC = useWritableValueWithCallbacks<number>(() => 1);

  const engine = useDynamicAnimationEngine();

  const handleEmotionClick = useCallback((emotion: Emotion) => {
    /* need at least 2s to consistently hide spinner */
    if (engine.playing.get()) {
      return;
    }
    setVWC(selectingEmotionVWC, emotion);

    const finish = resources.get().startGotoEmotion(emotion);
    engine.play([
      {
        id: 'irrelevantFadeOut',
        duration: 350,
        progressEase: { type: 'bezier', bezier: ease },
        onFrame: (progress) => {
          setVWC(irrelevantOpacityVWC, 1 - progress);
        },
      },
      {
        id: 'selectingSwapIn',
        duration: 350,
        progressEase: { type: 'bezier', bezier: ease },
        onFrame: (progress) => {
          setVWC(selectingEmotionOpacityVWC, 1 - progress);
        },
      },
      {
        id: 'headerSlideUp',
        duration: 350,
        progressEase: { type: 'bezier', bezier: ease },
        onFrame: (progress) => {
          setVWC(bkndImageSlideOutProgressVWC, progress);
        },
      },
      {
        id: 'bottomNavSlideOut',
        duration: 350,
        progressEase: { type: 'bezier', bezier: ease },
        onFrame: (progress) => {
          setVWC(bottomNavSlideOutProgressVWC, progress);
        },
      },
    ]);

    const onEnginePlayingChanged = () => {
      const v = engine.playing.get();
      if (!v) {
        engine.playing.callbacks.remove(onEnginePlayingChanged);

        const loc = swapInEmotionLocationVWC.get();
        finish(
          loc === null
            ? undefined
            : {
                emotionStart: { ...loc },
              }
        );
      }
    };

    engine.playing.callbacks.add(onEnginePlayingChanged);
  }, []);

  const backgroundImageVisibleHeightVWC = useMappedValuesWithCallbacks(
    [backgroundImageVWC, bkndImageSlideOutProgressVWC],
    () => backgroundImageVWC.get().displayHeight * (1 - bkndImageSlideOutProgressVWC.get())
  );

  const backgroundImageWrapperRef = useWritableValueWithCallbacks<HTMLDivElement | null>(
    () => null
  );
  useStyleVWC(
    backgroundImageWrapperRef,
    useMappedValueWithCallbacks(backgroundImageVisibleHeightVWC, (h) => ({ height: `${h}px` }))
  );

  const headerAndGoalWrapperRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(
    headerAndGoalWrapperRef,
    useMappedValueWithCallbacks(backgroundImageVisibleHeightVWC, (h) => ({ height: `${h}px` }))
  );

  const headerAndGoalOuterWrapperRef = useWritableValueWithCallbacks<HTMLDivElement | null>(
    () => null
  );
  useStyleVWC(
    headerAndGoalOuterWrapperRef,
    useMappedValueWithCallbacks(backgroundImageVWC, (bknd) => ({
      height: `${bknd.displayHeight}px`,
    }))
  );

  const bottomNavWrapperHeightVWC = useMappedValuesWithCallbacks(
    [bottomNavHeightVWC, bottomNavSlideOutProgressVWC],
    () => bottomNavHeightVWC.get() * (1 - bottomNavSlideOutProgressVWC.get())
  );
  const bottomNavWrapperRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(
    bottomNavWrapperRef,
    useMappedValueWithCallbacks(bottomNavWrapperHeightVWC, (h) => ({ height: `${h}px` }))
  );

  const bottomNavOuterWrapperRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(
    bottomNavOuterWrapperRef,
    useMappedValueWithCallbacks(bottomNavHeightVWC, (h) => ({ height: `${h}px` }))
  );

  const questionRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(
    questionRef,
    useMappedValueWithCallbacks(irrelevantOpacityVWC, (o) => ({ opacity: `${o}` }))
  );

  const selectingEmotionLocationVWC = useWritableValueWithCallbacks<{
    top: number;
    left: number;
    bottom: number;
    right: number;
  } | null>(() => null);

  const swapInEmotionLocationVWC = useWritableValueWithCallbacks<{
    top: number;
    left: number;
    bottom: number;
    right: number;
  } | null>(() => null);

  useMappedValuesWithCallbacks([selectingEmotionLocationVWC, selectingEmotionOpacityVWC], () => {
    const selOpacity = selectingEmotionOpacityVWC.get();
    if (selOpacity <= 0) {
      return;
    }

    const loc = selectingEmotionLocationVWC.get();
    if (loc !== null) {
      setVWC(swapInEmotionLocationVWC, {
        left: loc.left,
        top: loc.top,
        right: loc.right,
        bottom: loc.bottom,
      });
    }
  });

  const swapInEmotionStyleVWC = useMappedValueWithCallbacks(swapInEmotionLocationVWC, (loc) =>
    loc === null ? { left: '0', top: '0' } : { left: `${loc.left}px`, top: `${loc.top}px` }
  );

  const swapInEmotionRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(swapInEmotionRef, swapInEmotionStyleVWC);

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
      <div className={styles.background}>
        <div
          className={styles.backgroundImageWrapper}
          style={{ height: `${backgroundImageVisibleHeightVWC.get()}px` }}
          ref={(r) => setVWC(backgroundImageWrapperRef, r)}>
          <OsehImageFromStateValueWithCallbacks state={backgroundImageVWC} />
        </div>
        <div className={styles.bottomBackground} />
      </div>
      <div className={styles.foreground}>
        {/* outer wrapper prevents page shift */}
        <div
          className={styles.headerAndGoalOuterWrapper}
          style={{ height: `${backgroundImageVWC.get().displayHeight}px` }}
          ref={(r) => setVWC(headerAndGoalOuterWrapperRef, r)}>
          <div
            className={styles.headerAndGoalWrapper}
            style={{ height: `${backgroundImageVisibleHeightVWC.get()}px` }}
            ref={(r) => setVWC(headerAndGoalWrapperRef, r)}>
            <div className={styles.headerAndGoal} ref={(r) => setVWC(headerAndGoalRef, r)}>
              <div className={styles.header}>
                <div className={styles.headerTitleRow}>
                  <div className={styles.headerTitle}>
                    {greeting}
                    <RenderGuardedComponent props={nameVWC} component={(v) => v} />! 👋
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      resources.get().gotoAccount();
                    }}
                    className={styles.headerProfilePicture}>
                    <MyProfilePicture
                      displayWidth={32}
                      displayHeight={32}
                      imageHandler={state.get().imageHandler}
                    />
                  </button>
                </div>
                <div className={styles.headerBody}>
                  <RenderGuardedComponent
                    props={streakInfoVWC}
                    component={(v) => (
                      <>
                        You’ve meditated{' '}
                        <strong>
                          {v.type === 'success' ? numberToWord[v.result.daysOfWeek.length] : '?'}
                        </strong>{' '}
                        time{v.result?.daysOfWeek.length === 1 ? '' : 's'} this week.
                        {(() => {
                          if (v.type !== 'success') {
                            return;
                          }
                          const goal = v.result.goalDaysPerWeek;
                          if (goal === null) {
                            return;
                          }

                          if (v.result.daysOfWeek.length >= goal) {
                            return (
                              <>
                                {' '}
                                You’ve met your goal of {goal.toLocaleString()} day
                                {goal === 1 ? '' : 's'} for this week!
                              </>
                            );
                          }

                          const currentDayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...
                          let daysRemainingInWeek = 7 - currentDayOfWeek;
                          const currentDayOfWeekName = DAYS_OF_WEEK[(currentDayOfWeek + 6) % 7];
                          if (v.result.daysOfWeek.includes(currentDayOfWeekName)) {
                            daysRemainingInWeek--;
                          }
                          const requiredDays = goal - v.result.daysOfWeek.length;
                          if (requiredDays > daysRemainingInWeek) {
                            return;
                          }

                          return (
                            <>
                              {' '}
                              You can still make your goal of {goal.toLocaleString()} days this
                              week.
                            </>
                          );
                        })()}
                      </>
                    )}
                  />
                </div>
              </div>
              <div className={styles.goalWrapper}>
                <RenderGuardedComponent
                  props={streakInfoVWC}
                  component={(v) => (
                    <div className={styles.goal}>
                      <div className={styles.goalVisual}>
                        <div className={styles.goalVisualBackground}>
                          <VisualGoal state={visualGoalStateVWC.rendered} />
                        </div>
                        <div className={styles.goalVisualForeground}>
                          <div className={styles.goalVisualText}>
                            {v.type === 'success' ? v.result.daysOfWeek.length : '?'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          resources.get().gotoUpdateGoal();
                        }}
                        className={combineClasses(styles.goalSection, styles.goalSectionGoal)}>
                        <div className={styles.goalSectionTitle}>Goal</div>
                        <div className={styles.goalSectionValue}>
                          {v.type === 'success'
                            ? v.result.goalDaysPerWeek === null
                              ? 'TBD'
                              : `${v.result.daysOfWeek.length} of ${v.result.goalDaysPerWeek}`
                            : '?'}
                        </div>
                      </button>
                      <div className={styles.goalSection}>
                        <div className={styles.goalSectionTitle}>Streak</div>
                        <div className={styles.goalSectionValue}>
                          {v.type === 'success'
                            ? `${v.result.streak.toLocaleString()} day${
                                v.result.streak === 1 ? '' : 's'
                              }`
                            : '? days'}
                        </div>
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.content}>
          <div
            className={styles.question}
            style={{ opacity: `${irrelevantOpacityVWC.get()}` }}
            ref={(r) => setVWC(questionRef, r)}>
            How do you want to feel today?
          </div>
          <div className={styles.emotions} ref={(r) => setVWC(emotionsRef, r)}>
            <RenderGuardedComponent
              props={emotionRowsVWC}
              component={(r) => (
                <>
                  {r.map((row, idx) => (
                    <div key={idx} className={styles.emotionRow}>
                      <div className={styles.emotionRowInner}>
                        {row.map((emotion) => (
                          <EmotionButton
                            key={emotion.word}
                            emotion={emotion}
                            handleEmotionClick={handleEmotionClick}
                            selectingEmotionVWC={selectingEmotionVWC}
                            irrelevantOpacityVWC={irrelevantOpacityVWC}
                            selectingEmotionOpacityVWC={selectingEmotionOpacityVWC}
                            selectingEmotionLocationVWC={selectingEmotionLocationVWC}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            />
          </div>
        </div>
        <div
          className={styles.bottomNavOuterWrapper}
          style={{ height: `${bottomNavHeightVWC.get()}px` }}
          ref={(r) => setVWC(bottomNavOuterWrapperRef, r)}>
          <div
            className={styles.bottomNavWrapper}
            style={{ height: `${bottomNavWrapperHeightVWC.get()}px` }}
            ref={(r) => setVWC(bottomNavWrapperRef, r)}>
            <div className={styles.bottomNav} ref={(r) => setVWC(bottomNavRef, r)}>
              <BottomNavBar
                active="home"
                clickHandlers={{
                  series: () => {
                    if (engine.playing.get()) {
                      return;
                    }
                    resources.get().gotoSeries();
                  },
                  account: () => {
                    if (engine.playing.get()) {
                      return;
                    }
                    resources.get().gotoAccount();
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <RenderGuardedComponent
        props={selectingEmotionVWC}
        component={(v) =>
          v === null ? (
            <></>
          ) : (
            <div
              className={styles.selectEmotionSwapIn}
              style={swapInEmotionStyleVWC.get()}
              ref={(r) => setVWC(swapInEmotionRef, r)}>
              {v.word}
            </div>
          )
        }
      />
      {tutorial !== undefined && (
        <div className={styles.overlay} ref={(r) => setVWC(overlayVWC, r)}>
          <RenderGuardedComponent
            props={tutorial.step}
            component={(step) =>
              step === 'explain_top' ? (
                <div className={combineClasses(styles.tutorial, styles.tutorial1)}>
                  <div className={styles.tutorialTitle}>Celebrate your journey</div>
                  <div className={styles.tutorialText}>
                    Track your progress and celebrate milestones &mdash; we&rsquo;re here to cheer
                    you on 🎉
                  </div>
                  <div className={styles.tutorialControls}>
                    <div className={styles.tutorialProgress}>1/2</div>
                    <button
                      type="button"
                      className={styles.tutorialButton}
                      onClick={(e) => {
                        e.preventDefault();
                        tutorial?.onNextStep();
                      }}>
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <div className={combineClasses(styles.tutorial, styles.tutorial2)}>
                  <div className={styles.tutorialTitle}>Your perfect class is waiting</div>
                  <div className={styles.tutorialText}>
                    Select a mood and get a tailored class just for you.
                  </div>
                  <div className={styles.tutorialControls}>
                    <div className={styles.tutorialProgress}>2/2</div>
                    <button
                      type="button"
                      className={styles.tutorialButton}
                      onClick={async (e) => {
                        e.preventDefault();
                        tutorial?.onNextStep();
                      }}>
                      Done
                    </button>
                  </div>
                </div>
              )
            }
          />
        </div>
      )}
    </div>
  );
};

const EmotionButton = ({
  emotion,
  handleEmotionClick,
  selectingEmotionVWC,
  irrelevantOpacityVWC,
  selectingEmotionOpacityVWC,
  selectingEmotionLocationVWC,
}: {
  emotion: Emotion;
  handleEmotionClick: (emotion: Emotion) => void;
  selectingEmotionVWC: ValueWithCallbacks<Emotion | null>;
  irrelevantOpacityVWC: ValueWithCallbacks<number>;
  selectingEmotionOpacityVWC: ValueWithCallbacks<number>;
  selectingEmotionLocationVWC: WritableValueWithCallbacks<{
    top: number;
    left: number;
    bottom: number;
    right: number;
  } | null>;
}): ReactElement => {
  const buttonRef = useWritableValueWithCallbacks<HTMLButtonElement | null>(() => null);
  const opacityVWC = useMappedValuesWithCallbacks(
    [selectingEmotionVWC, selectingEmotionOpacityVWC, irrelevantOpacityVWC],
    () => {
      const selecting = selectingEmotionVWC.get();
      if (selecting === null) {
        return 1;
      }

      return selecting.word === emotion.word
        ? selectingEmotionOpacityVWC.get()
        : irrelevantOpacityVWC.get();
    }
  );

  useValuesWithCallbacksEffect([buttonRef, selectingEmotionVWC], () => {
    if (selectingEmotionVWC.get()?.word !== emotion.word) {
      return undefined;
    }

    const eleUnch = buttonRef.get();
    if (eleUnch === null) {
      return undefined;
    }
    const ele = eleUnch;
    // currently animations are specified in such a way only the initial
    // position matters, but in theory we could observe changes that occur
    // from window resizing
    onPositionChanged();
    return undefined;

    function onPositionChanged() {
      const rect = ele.getBoundingClientRect();
      setVWC(selectingEmotionLocationVWC, {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      });
    }
  });

  useStyleVWC(
    buttonRef,
    useMappedValueWithCallbacks(opacityVWC, (opacity) => ({ opacity: `${opacity}` }))
  );

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        handleEmotionClick(emotion);
      }}
      className={styles.emotionButton}
      style={{ opacity: `${opacityVWC.get()}` }}
      key={emotion.word}
      ref={(r) => setVWC(buttonRef, r)}>
      {emotion.word}
    </button>
  );
};

const numberToWord: Record<number, string> = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
};
