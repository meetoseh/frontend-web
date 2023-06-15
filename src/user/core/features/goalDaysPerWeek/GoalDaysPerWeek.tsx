import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { GoalDaysPerWeekState } from './GoalDaysPerWeekState';
import { GoalDaysPerWeekResources } from './GoalDaysPerWeekResources';
import styles from './GoalDaysPerWeek.module.css';
import { Button } from '../../../../shared/forms/Button';
import { OsehImageFromState } from '../../../../shared/OsehImage';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { LoginContext } from '../../../../shared/LoginContext';
import { apiFetch } from '../../../../shared/ApiConstants';
import { ErrorBlock, describeError } from '../../../../shared/forms/ErrorBlock';
import { InterestsContext } from '../../../../shared/InterestsContext';

export const GoalDaysPerWeek = ({
  state,
  resources,
  doAnticipateState,
}: FeatureComponentProps<GoalDaysPerWeekState, GoalDaysPerWeekResources>): ReactElement => {
  useStartSession(resources.session);
  const loginContext = useContext(LoginContext);
  const interests = useContext(InterestsContext);
  const [goal, setGoal] = useState<number>(3);
  const [error, setError] = useState<ReactElement | null>(null);

  const boundSetGoals = useMemo<(() => void)[]>(() => {
    return [1, 2, 3, 4, 5, 6, 7].map((i) => () => setGoal(i));
  }, []);

  const onFinish = useCallback(() => {
    resources.session?.storeAction?.call(undefined, 'set_goal', { days_per_week: goal });
    const newState = {
      ...state,
      signupIAP: state.ian?.onShown?.call(undefined, true) ?? null,
    };

    doAnticipateState(
      newState,
      (async () => {
        try {
          const response = await apiFetch(
            '/api/1/users/me/goal',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                days_per_week: goal,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          resources.session?.reset?.call(undefined);
          state.ian?.onShown?.call(undefined);
        } catch (e) {
          const err = await describeError(e);
          setError(err);
          throw new Error('Failed to store goal');
        }
      })()
    );
  }, [doAnticipateState, state, resources.session, goal, loginContext]);

  if (resources.background === null) {
    return <></>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...resources.background} />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>
          {(() => {
            const defaultCopy = (
              <>
                Let&rsquo;s set a goal, how many days a week do you want to{' '}
                <span style={{ whiteSpace: 'nowrap' }}>check-in?</span>
              </>
            );

            if (interests.state !== 'loaded') {
              return defaultCopy;
            } else if (interests.primaryInterest === 'sleep') {
              return (
                <>
                  Regular sleep starts with a regular schedule: how many days a week do you want to{' '}
                  <span style={{ whiteSpace: 'nowrap' }}>check-in?</span>
                </>
              );
            } else {
              return defaultCopy;
            }
          })()}
        </div>
        <div className={styles.days}>
          {boundSetGoals.map((setGoal, i) => (
            <button
              type="button"
              onClick={setGoal}
              className={combineClasses(styles.day, i + 1 === goal ? styles.dayActive : undefined)}
              key={i}>
              {i + 1}
            </button>
          ))}
        </div>
        {error && <ErrorBlock>{error}</ErrorBlock>}
        <div className={styles.submitContainer}>
          <Button type="button" variant="filled-white" fullWidth onClick={onFinish}>
            Set Goal
          </Button>
        </div>
      </div>
    </div>
  );
};
