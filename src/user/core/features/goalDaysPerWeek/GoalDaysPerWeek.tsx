import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { GoalDaysPerWeekState } from './GoalDaysPerWeekState';
import { GoalDaysPerWeekResources } from './GoalDaysPerWeekResources';
import styles from './GoalDaysPerWeek.module.css';
import { Button } from '../../../../shared/forms/Button';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../../shared/ApiConstants';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import {
  InterestsContext,
  InterestsContextValue,
} from '../../../../shared/contexts/InterestsContext';
import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';

export const GoalDaysPerWeek = ({
  state,
  resources,
}: FeatureComponentProps<GoalDaysPerWeekState, GoalDaysPerWeekResources>): ReactElement => {
  useStartSession({
    type: 'callbacks',
    props: () => resources.get().session,
    callbacks: resources.callbacks,
  });
  const loginContext = useContext(LoginContext);
  const interests = useContext(InterestsContext);
  const modalContext = useContext(ModalContext);
  const goal = useWritableValueWithCallbacks<number>(() => 3);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  const boundSetGoals = useMemo<(() => void)[]>(() => {
    return [1, 2, 3, 4, 5, 6, 7].map((i) => () => setVWC(goal, i));
  }, [goal]);

  const goalIsActive = useMemo<ValueWithCallbacks<boolean>[]>(() => {
    return [1, 2, 3, 4, 5, 6, 7].map((i) => {
      const result = createWritableValueWithCallbacks(goal.get() === i);
      goal.callbacks.add(() => setVWC(result, goal.get() === i));
      return result;
    });
  }, [goal]);

  const onFinish = useCallback(async () => {
    const selected = goal.get();
    resources.get().session?.storeAction?.call(undefined, 'set_goal', { days_per_week: selected });
    state.get().ian?.onShown?.call(undefined, true);
    try {
      const response = await apiFetch(
        '/api/1/users/me/goal',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            days_per_week: selected,
          }),
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      resources.get().session?.reset?.call(undefined);
      state.get().ian?.onShown?.call(undefined);
    } catch (e) {
      const err = await describeError(e);
      setVWC(error, err);
      throw new Error('Failed to store goal');
    }
  }, [state, resources, error, goal, loginContext]);

  const title = useMemo(() => getTitle(interests), [interests]);
  useErrorModal(modalContext.modals, error, 'Set Goal');

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks
          state={useMappedValueWithCallbacks(resources, (r) => r.background)}
        />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.days}>
          {boundSetGoals.map((setGoal, i) => (
            <RenderGuardedComponent
              key={i}
              props={goalIsActive[i]}
              component={(isActive) => (
                <button
                  type="button"
                  onClick={setGoal}
                  className={combineClasses(styles.day, isActive ? styles.dayActive : undefined)}>
                  {i + 1}
                </button>
              )}
            />
          ))}
        </div>
        <div className={styles.submitContainer}>
          <Button type="button" variant="filled-white" fullWidth onClick={onFinish}>
            Set Goal
          </Button>
        </div>
      </div>
    </div>
  );
};

const getTitle = (interests: InterestsContextValue): ReactElement => {
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
};
