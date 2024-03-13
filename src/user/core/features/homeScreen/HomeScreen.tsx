import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { HomeScreenResources } from './HomeScreenResources';
import { HomeScreenState } from './HomeScreenState';
import styles from './HomeScreen.module.css';
import { FullHeightDiv } from '../../../../shared/components/FullHeightDiv';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { MyProfilePicture } from '../../../../shared/components/MyProfilePicture';
import { makeSVGNumber } from '../../../../shared/anim/svgUtils';
import { Callbacks, useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValuesWithCallbacksEffect } from '../../../../shared/hooks/useValuesWithCallbacksEffect';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { BottomNavBar } from '../../../bottomNav/BottomNavBar';
import { Emotion } from '../pickEmotionJourney/Emotion';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { DAYS_OF_WEEK } from '../../../../shared/models/DayOfWeek';

/**
 * Displays the home screen for the user
 */
export const HomeScreen = ({
  state,
  resources,
}: FeatureComponentProps<HomeScreenState, HomeScreenResources>): ReactElement => {
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
    if (
      loginContextUnch.state !== 'logged-in' ||
      loginContextUnch.userAttributes.givenName === null ||
      loginContextUnch.userAttributes.givenName.toLowerCase() === 'anonymous' ||
      loginContextUnch.userAttributes.givenName.toLowerCase() === 'there'
    ) {
      return <></>;
    }
    const loginContext = loginContextUnch;
    return <>, {loginContext.userAttributes.givenName}</>;
  });

  const backgroundImageVWC = useMappedValueWithCallbacks(resources, (r) => r.backgroundImage);
  const headerAndGoalRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);

  useValuesWithCallbacksEffect([backgroundImageVWC, headerAndGoalRef], () => {
    const ele = headerAndGoalRef.get();
    if (ele === null) {
      return undefined;
    }

    const bknd = backgroundImageVWC.get();
    ele.style.minHeight = `${bknd.displayHeight}px`;
    return undefined;
  });

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

  const handleEmotionClick = useCallback((emotion: Emotion) => {
    resources.get().startGotoEmotion(emotion)();
  }, []);

  return (
    <FullHeightDiv className={styles.container}>
      <div className={styles.background}>
        <OsehImageFromStateValueWithCallbacks state={backgroundImageVWC} />
        <div className={styles.bottomBackground} />
      </div>
      <div className={styles.foreground}>
        <div className={styles.headerAndGoal} ref={(r) => setVWC(headerAndGoalRef, r)}>
          <div className={styles.header}>
            <div className={styles.headerTitleRow}>
              <div className={styles.headerTitle}>
                {greeting}
                <RenderGuardedComponent props={nameVWC} component={(v) => v} />! 👋
              </div>
              <div className={styles.headerProfilePicture}>
                <MyProfilePicture
                  displayWidth={32}
                  displayHeight={32}
                  imageHandler={resources.get().imageHandler}
                />
              </div>
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
                          You can still make your goal of {goal.toLocaleString()} days this week.
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
                      {(() => {
                        const filled = v.result?.daysOfWeek.length ?? 0;
                        const radius = 45;
                        const strokeWidth = 6;
                        const viewBox = {
                          w: radius * 2 + strokeWidth + 2,
                          h: radius * 2 + strokeWidth + 2,
                        };
                        const cx = viewBox.w / 2;
                        const cy = viewBox.h / 2;

                        const cutAngleDegrees = 70;
                        const spacerAngleDegrees = 2;
                        const remainingAngleDegrees =
                          360 - cutAngleDegrees - 6 * spacerAngleDegrees;
                        const partAngleDegrees = remainingAngleDegrees / 7;
                        const filledColor = '#EAEAEB';
                        const filledOpacity = '1';
                        const unfilledColor = '#FFFFFF';
                        const unfilledOpacity = '0.35';

                        const angleProportions = [0.9, 1, 1, 1.2, 1.1, 1, 0.9];
                        const angleProportionsSum = angleProportions.reduce((a, b) => a + b, 0);
                        const angleByPartIdx = angleProportions.map(
                          (p) => (p / angleProportionsSum) * partAngleDegrees * 7
                        );

                        const paths: ReactElement[] = [];
                        const svgn = makeSVGNumber;
                        let nextStartAngleCWFromBottom = cutAngleDegrees / 2;
                        for (let idx = 0; idx < 7; idx++) {
                          const startAngleCWFromBottom = nextStartAngleCWFromBottom;
                          nextStartAngleCWFromBottom += angleByPartIdx[idx] + spacerAngleDegrees;
                          const startAngleStd = (startAngleCWFromBottom + 90) % 360;

                          const startPosition = {
                            x: cx + radius * Math.cos((startAngleStd * Math.PI) / 180),
                            y: cy + radius * Math.sin((startAngleStd * Math.PI) / 180),
                          };
                          const endAngleStd = (startAngleStd + angleByPartIdx[idx]) % 360;
                          const endPosition = {
                            x: cx + radius * Math.cos((endAngleStd * Math.PI) / 180),
                            y: cy + radius * Math.sin((endAngleStd * Math.PI) / 180),
                          };
                          const largeAngleFlag = 0;
                          const sweepFlag = 1;
                          const isFilled = idx < filled;
                          const marker = isFilled
                            ? { start: 'url(#roundFilled)', end: 'url(#roundFilled)' }
                            : {
                                start: 'url(#roundUnfilledStart)',
                                end: 'url(#roundUnfilledEnd)',
                              };

                          paths.push(
                            <path
                              d={`M${svgn(startPosition.x)} ${svgn(startPosition.y)} A${svgn(
                                radius
                              )} ${svgn(radius)} 0 ${svgn(largeAngleFlag)} ${svgn(
                                sweepFlag
                              )} ${svgn(endPosition.x)} ${svgn(endPosition.y)}`}
                              stroke={isFilled ? filledColor : unfilledColor}
                              strokeOpacity={isFilled ? filledOpacity : unfilledOpacity}
                              strokeWidth={svgn(strokeWidth)}
                              fill="none"
                              key={idx}
                              markerStart={idx === 0 ? marker.start : undefined}
                              markerEnd={idx === 6 ? marker.end : undefined}
                            />
                          );
                        }

                        return (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
                            width="64"
                            height="64">
                            <defs>
                              <marker
                                id="roundFilled"
                                viewBox="-1 -1 2 2"
                                markerWidth="1"
                                orient="auto">
                                <circle r="1" fill={filledColor} fillOpacity={filledOpacity} />
                              </marker>
                              <marker
                                id="roundUnfilledStart"
                                viewBox="-1 -1 2 2"
                                markerWidth="1"
                                orient="auto">
                                <path
                                  d="M0.002 -1A1 1 0 0 0 0.002 1Z"
                                  fill={unfilledColor}
                                  fillOpacity={unfilledOpacity}
                                  stroke="none"
                                />
                              </marker>
                              <marker
                                id="roundUnfilledEnd"
                                viewBox="-1 -1 2 2"
                                markerWidth="1"
                                orient="auto">
                                <path
                                  d="M-0.002 1A1 1 0 0 0 -0.002 -1Z"
                                  fill={unfilledColor}
                                  fillOpacity={unfilledOpacity}
                                  stroke="none"
                                />
                              </marker>
                            </defs>
                            {paths}
                          </svg>
                        );
                      })()}
                    </div>
                    <div className={styles.goalVisualForeground}>
                      <div className={styles.goalVisualText}>
                        {v.type === 'success' ? v.result.daysOfWeek.length : '?'}
                      </div>
                    </div>
                  </div>
                  <div className={styles.goalSection}>
                    <div className={styles.goalSectionTitle}>Goal</div>
                    <div className={styles.goalSectionValue}>
                      {v.type === 'success'
                        ? v.result.goalDaysPerWeek === null
                          ? 'Unset'
                          : `${v.result.daysOfWeek.length} of ${v.result.goalDaysPerWeek}`
                        : '?'}
                    </div>
                  </div>
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
        <div className={styles.content}>
          <div className={styles.question}>How do you want to feel today?</div>
          <div className={styles.emotions} ref={(r) => setVWC(emotionsRef, r)}>
            <RenderGuardedComponent
              props={emotionRowsVWC}
              component={(r) => (
                <>
                  {r.map((row, idx) => (
                    <div key={idx} className={styles.emotionRow}>
                      <div className={styles.emotionRowInner}>
                        {row.map((emotion) => (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleEmotionClick(emotion);
                            }}
                            className={styles.emotionButton}
                            key={emotion.word}>
                            {emotion.word}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            />
          </div>
        </div>
        <div className={styles.bottomNav}>
          <BottomNavBar
            active="home"
            clickHandlers={{
              series: () => resources.get().gotoSeries(),
              account: () => resources.get().gotoAccount(),
            }}
          />
        </div>
      </div>
    </FullHeightDiv>
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
