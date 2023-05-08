import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { describeError, ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { OsehImageFromState } from '../../../shared/OsehImage';
import styles from './JourneyPostScreen.module.css';
import assistiveStyles from '../../../shared/assistive.module.css';
import { LoginContext } from '../../../shared/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { JourneyScreenProps } from '../models/JourneyScreenProps';
import { SplashScreen } from '../../splash/SplashScreen';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { Button } from '../../../shared/forms/Button';

type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

type StreakInfo = {
  /**
   * The number of consecutive days the user has taken a class
   */
  streak: number;
  /**
   * The days of the week the user has taken a class
   */
  daysOfWeek: DayOfWeek[];
  /**
   * The number of days per week the user has taken a class
   */
  goalDaysPerWeek: number | null;
};

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
  const loginContext = useContext(LoginContext);
  const [error, setError] = useState<ReactElement | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    let active = true;
    fetchStreak();
    return () => {
      active = false;
    };

    async function fetchStreak() {
      setError(null);
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
        const data: {
          streak: number;
          days_of_week: DayOfWeek[];
          goal_days_per_week: number | null;
        } = await response.json();
        if (!active) {
          return;
        }
        setStreak({
          streak: data.streak,
          daysOfWeek: data.days_of_week,
          goalDaysPerWeek: data.goal_days_per_week,
        });
      } catch (e) {
        if (!active) {
          return;
        }
        const err = await describeError(e);
        if (!active) {
          return;
        }
        setError(err);
      }
    }
  }, [loginContext]);

  const onContinue = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (overrideOnContinue) {
        overrideOnContinue();
      } else {
        onJourneyFinished();
      }
    },
    [onJourneyFinished, overrideOnContinue]
  );

  if (streak === null) {
    return <SplashScreen />;
  }

  const userIdentifier = (() => {
    if (
      loginContext.userAttributes === null ||
      loginContext.userAttributes.givenName === 'Anonymous'
    ) {
      return null;
    }

    return loginContext.userAttributes.givenName;
  })();

  const title = (() => {
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
  })();

  const goalText = ((): ReactElement | null => {
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
          You&rsquo;ve practiced {numToName[daysSoFar]} day{daysSoFar === 1 ? '' : 's'} so far this
          week&#8212;you can still make your goal of {goal} day{goal === 1 ? '' : 's'} 👏
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
  })();

  const completedDaysSet = new Set(streak.daysOfWeek);

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...shared.blurredImage!} />
      </div>
      <div className={styles.innerContainer}>
        {error !== null ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <button type="button" className={styles.close} onClick={onJourneyFinished}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </button>
          </div>
        </div>

        <div className={styles.primaryContainer}>
          <div className={styles.topSpacer}></div>
          <div className={styles.title}>{title}</div>
          <div className={styles.streak}>
            <div className={styles.streakNumber}>
              {streak.streak.toLocaleString(undefined, { useGrouping: true })}
            </div>
            <div className={styles.streakUnit}>day streak</div>
          </div>
          <div className={styles.weekdays}>
            {DAYS_OF_WEEK.map((day) => {
              return (
                <div className={styles.weekday} key={day}>
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
              );
            })}
          </div>
          {goalText && <div className={styles.goal}>{goalText}</div>}
          <div className={styles.buttonContainer}>
            <Button type="button" variant="filled-white" onClick={onContinue} fullWidth>
              {isOnboarding ? 'Continue' : 'Take Another Class'}
            </Button>
          </div>
          <div className={styles.bottomSpacer}></div>
        </div>
      </div>
    </div>
  );
};
