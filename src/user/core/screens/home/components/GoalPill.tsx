import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { ValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { combineClasses } from '../../../../../shared/lib/combineClasses';
import { StreakInfo } from '../../../../journey/models/StreakInfo';
import { VisualGoal, VisualGoalState } from './VisualGoal';
import styles from './GoalPill.module.css';

/**
 * The standard goal pill which visually indicates the users streak information
 */
export const GoalPill = ({
  streak,
  updateGoal,
}: {
  streak: ValueWithCallbacks<StreakInfo | null>;
  updateGoal: () => void;
}) => {
  return (
    <div className={styles.goal}>
      <div className={styles.goalVisual}>
        <div className={styles.goalVisualBackground}>
          <VisualGoal
            state={useMappedValueWithCallbacks(
              streak,
              (streak): VisualGoalState => ({
                filled: streak?.daysOfWeek?.length ?? 0,
                goal: streak?.goalDaysPerWeek ?? 3,
              })
            )}
          />
        </div>
        <div className={styles.goalVisualForeground}>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(streak, (s) => s?.daysOfWeek?.length ?? 0)}
            component={(days) => <div className={styles.goalVisualText}>{days}</div>}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          updateGoal();
        }}
        className={combineClasses(styles.goalSection, styles.goalSectionGoal)}>
        <div className={styles.goalSectionTitle}>Goal</div>
        <RenderGuardedComponent
          props={streak}
          component={(streak) => (
            <div className={styles.goalSectionValue}>
              {streak === null || streak.goalDaysPerWeek === null
                ? 'TBD'
                : `${streak.daysOfWeek.length} of ${streak.goalDaysPerWeek}`}
            </div>
          )}
        />
      </button>
      <div className={styles.goalSection}>
        <div className={styles.goalSectionTitle}>Streak</div>
        <RenderGuardedComponent
          props={useMappedValueWithCallbacks(streak, (s) => s?.streak?.toLocaleString() ?? '?')}
          component={(days) => (
            <div className={styles.goalSectionValue}>
              {days} day{days === '1' ? '' : 's'}
            </div>
          )}
        />
      </div>
    </div>
  );
};
