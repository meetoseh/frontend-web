import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { TouchPointSelectionStrategy } from '../TouchPoint';
import {
  touchPointSelectionStrategies,
  touchPointSelectionStrategyInfo,
} from '../models/TouchPointSelectionStrategy';
import styles from './TouchPointSelectionStrategy.module.css';

export type TouchPointSelectionStrategySelectProps = {
  vwc: WritableValueWithCallbacks<TouchPointSelectionStrategy>;
};

/**
 * Shows a select where the user can choose the touch point selection strategy.
 */
export const TouchPointSelectionStrategySelect = ({
  vwc,
}: TouchPointSelectionStrategySelectProps) => {
  return (
    <div className={styles.selectContainer}>
      <RenderGuardedComponent
        props={vwc}
        component={(selectionStrategy) => (
          <select
            className={styles.select}
            value={selectionStrategy}
            onChange={(e) => {
              const newValue = e.target.value as TouchPointSelectionStrategy;
              setVWC(vwc, newValue);
            }}>
            {touchPointSelectionStrategies.map((strategy) => (
              <option key={strategy} value={strategy}>
                {touchPointSelectionStrategyInfo[strategy].name()}
              </option>
            ))}
          </select>
        )}
        applyInstantly
      />
      <RenderGuardedComponent
        props={vwc}
        component={(selectionStrategy) => (
          <div className={styles.selectionStrategyDescription}>
            {touchPointSelectionStrategyInfo[selectionStrategy].description()}
          </div>
        )}
      />
    </div>
  );
};
