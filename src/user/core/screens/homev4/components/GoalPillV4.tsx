import { HorizontalSpacer } from '../../../../../shared/components/HorizontalSpacer';
import { CheckFilled } from '../../../../../shared/components/icons/CheckFilled';
import { Streak } from '../../../../../shared/components/icons/Streak';
import { RenderGuardedComponent } from '../../../../../shared/components/RenderGuardedComponent';
import { VerticalSpacer } from '../../../../../shared/components/VerticalSpacer';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { ValueWithCallbacks } from '../../../../../shared/lib/Callbacks';
import { combineClasses } from '../../../../../shared/lib/combineClasses';
import { OsehColors } from '../../../../../shared/OsehColors';
import { StreakInfo } from '../../../../journey/models/StreakInfo';
import { VisualGoal, VisualGoalState } from '../../home/components/VisualGoal';
import styles from './GoalPillV4.module.css';

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
    <div className={styles.row}>
      <div className={styles.vstack}>
        <div className={styles.vstackItem}>
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
        <div className={styles.vstackItem}>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(streak, (s) => s?.daysOfWeek?.length ?? 0)}
            component={(days) => <div className={styles.goalVisualText}>{days}</div>}
          />
        </div>
      </div>
      <HorizontalSpacer width={24} />
      <div className={styles.streakAndGoal}>
        <div className={styles.row}>
          <HorizontalSpacer width={24} />
          <div className={styles.column}>
            <VerticalSpacer height={12} />
            <div className={styles.row}>
              <Streak
                icon={{
                  height: 12,
                }}
                container={{
                  width: 16,
                  height: 17,
                }}
                startPadding={{
                  x: {
                    fraction: 0.5,
                  },
                  y: {
                    fraction: 0.5,
                  },
                }}
                color={OsehColors.v4.primary.smoke}
              />
              <HorizontalSpacer width={4} />
              <div className={styles.sectionTitle}>Streak</div>
            </div>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(streak, (s) => s?.streak?.toLocaleString() ?? '?')}
              component={(days) => (
                <div className={styles.sectionValue}>
                  {days} day{days === '1' ? '' : 's'}
                </div>
              )}
            />
            <VerticalSpacer height={12} />
          </div>
          <HorizontalSpacer width={36} />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              updateGoal();
            }}
            className={combineClasses(styles.goalButton)}>
            <div className={styles.column}>
              <VerticalSpacer height={12} />
              <div className={styles.row}>
                <CheckFilled
                  icon={{
                    height: 12,
                  }}
                  container={{
                    width: 16,
                    height: 17,
                  }}
                  startPadding={{
                    x: {
                      fraction: 0.5,
                    },
                    y: {
                      fraction: 0.5,
                    },
                  }}
                  color={OsehColors.v4.primary.smoke}
                />
                <HorizontalSpacer width={4} />
                <div className={styles.sectionTitle}>Goal</div>
              </div>
              <RenderGuardedComponent
                props={streak}
                component={(streak) => (
                  <div className={styles.sectionValue}>
                    {streak === null || streak.goalDaysPerWeek === null
                      ? 'TBD'
                      : `${streak.daysOfWeek.length} of ${streak.goalDaysPerWeek}`}
                  </div>
                )}
              />
              <VerticalSpacer height={12} />
            </div>
          </button>
          <HorizontalSpacer width={24} />
        </div>
      </div>
    </div>
  );
};
