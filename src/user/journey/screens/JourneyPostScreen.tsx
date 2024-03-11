import { ReactElement, useCallback, useContext } from 'react';
import { describeError } from '../../../shared/forms/ErrorBlock';
import styles from './JourneyPostScreen.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { Button } from '../../../shared/forms/Button';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { useToggleFavorited } from '../hooks/useToggleFavorited';
import { InlineOsehSpinner } from '../../../shared/components/InlineOsehSpinner';
import { useErrorModal } from '../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../shared/contexts/ModalContext';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { convertUsingMapper } from '../../../admin/crud/CrudFetcher';
import { StreakInfo, streakInfoKeyMap } from '../models/StreakInfo';
import { DAYS_OF_WEEK, DayOfWeek } from '../../../shared/models/DayOfWeek';

export const JourneyPostScreen = ({
  journey,
  shared,
  setScreen,
  onJourneyFinished,
  isOnboarding,
  classesTakenToday,
  overrideOnContinue,
}: JourneyScreenProps & {
  /**
   * The number of classes the user has taken this session, used to
   * personalize the goal message in some cases
   */
  classesTakenToday?: number;

  /**
   * Normally the cta button will call onJourneyFinished, which is the
   * same function that's called if the user clicks the X or uses any
   * other method to close the screen. If this prop is specified, instead
   * the cta button will call this function.
   */
  overrideOnContinue?: () => void;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const streakVWC = useWritableValueWithCallbacks<StreakInfo | null>(() => null);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchStreak();
        return () => {
          active = false;
        };

        async function fetchStreak() {
          setVWC(errorVWC, null);
          try {
            const response = await apiFetch(
              '/api/1/users/me/streak',
              {
                method: 'GET',
              },
              loginContext
            );
            if (!active) {
              return;
            }
            if (!response.ok) {
              throw response;
            }
            const data = await response.json();
            if (!active) {
              return;
            }
            setVWC(streakVWC, convertUsingMapper(data, streakInfoKeyMap));
          } catch (e) {
            if (!active) {
              return;
            }
            const err = await describeError(e);
            if (!active) {
              return;
            }
            setVWC(errorVWC, err);
          }
        }
      },
      [errorVWC, streakVWC]
    )
  );

  const onContinue = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (overrideOnContinue) {
        overrideOnContinue();
      } else {
        onJourneyFinished(true);
      }
    },
    [onJourneyFinished, overrideOnContinue]
  );

  const onCloseClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onJourneyFinished(true);
    },
    [onJourneyFinished]
  );

  const toggleFavorited = useToggleFavorited({
    journey: { type: 'react-rerender', props: journey },
    shared,
  });

  const onToggleFavorited = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      toggleFavorited();
    },
    [toggleFavorited]
  );

  const blurredImage = useMappedValueWithCallbacks(shared, (s) => s.blurredImage);

  const userIdentifierVWC = useMappedValueWithCallbacks(
    loginContextRaw.value,
    (loginContextUnch) => {
      if (
        loginContextUnch.state !== 'logged-in' ||
        loginContextUnch.userAttributes.givenName === 'Anonymous'
      ) {
        return null;
      }

      return loginContextUnch.userAttributes.givenName;
    }
  );

  const titleVWC = useMappedValuesWithCallbacks(
    [userIdentifierVWC, streakVWC],
    useCallback((): ReactElement => {
      const userIdentifier = userIdentifierVWC.get();
      const streak = streakVWC.get();
      if (streak === null) {
        return <InlineOsehSpinner size={{ type: 'react-rerender', props: { height: 24 } }} />;
      }

      if (isOnboarding) {
        return <>{userIdentifier ? `${userIdentifier}, h` : 'H'}igh-five on your first class!</>;
      }

      if (streak.streak === 1) {
        if (classesTakenToday === 3) {
          return (
            <>
              Fantastic work{userIdentifier ? `, ${userIdentifier}` : ''}&#8212;but you don&rsquo;t
              need to do it all today!
            </>
          );
        }
        return <>{userIdentifier ? `${userIdentifier}, h` : 'H'}igh-five on your new streak!</>;
      }

      if (streak.streak === 2) {
        return <>Lift-off{userIdentifier ? `, ${userIdentifier}` : ''} 🚀 Keep it up!</>;
      }

      if (streak.streak === 3) {
        return (
          <>
            Congratulations on making it to day {streak.streak}
            {userIdentifier ? `, ${userIdentifier}` : ''}!
          </>
        );
      }

      if (
        streak.streak === 5 &&
        streak.daysOfWeek.includes('Monday') &&
        streak.daysOfWeek.includes('Friday')
      ) {
        return <>A clean streak this week{userIdentifier ? `, ${userIdentifier}` : ''}! 🎉</>;
      }

      if (streak.streak < 7) {
        return <>{userIdentifier}, you&rsquo;re on a roll!</>;
      }

      if (streak.streak === 7) {
        return (
          <>A full week&#8212;exceptional work{userIdentifier ? `, ${userIdentifier}!` : '!'} 😎</>
        );
      }

      if ([30, 50, 100, 200, 365, 500, 1000].includes(streak.streak)) {
        return <>You&rsquo;re on fire{userIdentifier ? `, ${userIdentifier}` : ''} 🔥</>;
      }

      return <>{userIdentifier ? `${userIdentifier}, h` : 'H'}igh-five on your new streak!</>;
    }, [isOnboarding, userIdentifierVWC, streakVWC, classesTakenToday])
  );

  const goalTextVWC = useMappedValueWithCallbacks(
    streakVWC,
    useCallback((streak): ReactElement | null => {
      if (streak === null) {
        return <InlineOsehSpinner size={{ type: 'react-rerender', props: { height: 14 } }} />;
      }

      if (streak.goalDaysPerWeek === null) {
        return null;
      }

      const goal = streak.goalDaysPerWeek;
      const daysSoFar = streak.daysOfWeek.length;
      const curDayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
      const curDayOfWeekIdx = DAYS_OF_WEEK.indexOf(curDayOfWeek);
      const remainingNumDays = 6 - curDayOfWeekIdx;

      const numToName = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

      if (daysSoFar < goal && daysSoFar + remainingNumDays >= goal) {
        return (
          <>
            You&rsquo;ve practiced {numToName[daysSoFar]} day{daysSoFar === 1 ? '' : 's'} so far
            this week&#8212;you can still make your goal of {goal} day{goal === 1 ? '' : 's'} 👏
          </>
        );
      }

      if (daysSoFar === goal) {
        return (
          <>
            You&rsquo;ve reached your goal of {goal} day{goal === 1 ? '' : 's'} this week! 🎉
          </>
        );
      }

      if (daysSoFar > goal) {
        return (
          <>
            You&rsquo;ve exceeded your goal of {goal} day{goal === 1 ? '' : 's'}! 🏅
          </>
        );
      }

      return null;
    }, [])
  );

  const completedDaysSetVWC = useMappedValueWithCallbacks(streakVWC, (streak) => {
    return new Set(streak?.daysOfWeek ?? []);
  });

  const modalContext = useContext(ModalContext);
  useErrorModal(modalContext.modals, errorVWC, 'JourneyPostScreen streak');

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks state={blurredImage} />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <button type="button" className={styles.close} onClick={onCloseClick}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </button>
          </div>
        </div>

        <div className={styles.primaryContainer}>
          <div className={styles.topSpacer}></div>
          <RenderGuardedComponent
            props={titleVWC}
            component={(title) => <div className={styles.title}>{title}</div>}
          />
          <div className={styles.streak}>
            <div className={styles.streakNumber}>
              <RenderGuardedComponent
                props={streakVWC}
                component={(streak) => {
                  if (streak === null) {
                    return (
                      <InlineOsehSpinner
                        size={{ type: 'react-rerender', props: { height: 100 } }}
                      />
                    );
                  }
                  return <>{streak.streak.toLocaleString(undefined, { useGrouping: true })}</>;
                }}
              />
            </div>
            <div className={styles.streakUnit}>day streak</div>
          </div>
          <div className={styles.weekdays}>
            {DAYS_OF_WEEK.map((day) => {
              return (
                <RenderGuardedComponent
                  key={day}
                  props={completedDaysSetVWC}
                  component={(completedDaysSet) => (
                    <div className={styles.weekday}>
                      <div
                        className={combineClasses(
                          styles.weekdayIcon,
                          completedDaysSet.has(day)
                            ? styles.weekdayIconCompleted
                            : styles.weekdayIconIncomplete
                        )}
                      />
                      <div className={styles.weekdayLabel}>{day.substring(0, 3)}</div>
                    </div>
                  )}
                />
              );
            })}
          </div>
          <RenderGuardedComponent
            props={goalTextVWC}
            component={(goalText) => (
              <>{goalText && <div className={styles.goal}>{goalText}</div>}</>
            )}
          />
          <div className={styles.buttonContainer}>
            <Button type="button" variant="filled-white" onClick={onContinue} fullWidth>
              Continue
            </Button>
          </div>
          <RenderGuardedComponent
            props={shared}
            component={(s) => (
              <div
                className={styles.favoriteContainer}
                style={s.favorited === null ? { display: 'none' } : undefined}>
                <Button type="button" variant="link-white" onClick={onToggleFavorited} fullWidth>
                  <div className={styles.favoriteButtonContents}>
                    {s.favorited ? (
                      <>
                        <div className={styles.favoritedIcon} />
                        Remove from favorites
                      </>
                    ) : (
                      <>
                        <div className={styles.unfavoritedIcon} />
                        Add to favorites
                      </>
                    )}
                  </div>
                </Button>
              </div>
            )}
          />
          <div className={styles.bottomSpacer}></div>
        </div>
      </div>
    </div>
  );
};
