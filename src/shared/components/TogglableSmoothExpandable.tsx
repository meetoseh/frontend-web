import { PropsWithChildren, ReactElement, useCallback } from 'react';
import styles from './TogglableSmoothExpandable.module.css';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { Button } from '../forms/Button';
import { SmoothExpandable } from './SmoothExpandable';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../lib/adaptValueWithCallbacksAsVariableStrategyProps';

/**
 * A basic component which has a show/hide button to expand/collapse the
 * component.
 */
export const TogglableSmoothExpandable = ({
  children,
}: PropsWithChildren<object>): ReactElement => {
  const expanded = useWritableValueWithCallbacks(() => false);

  const toggleExpanded = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setVWC(expanded, !expanded.get());
    },
    [expanded]
  );

  return (
    <div className={styles.container}>
      <Button type="button" variant="link-small" onClick={toggleExpanded}>
        <RenderGuardedComponent
          props={expanded}
          component={(expanded) => (expanded ? <>Hide</> : <>Show more</>)}
        />
      </Button>
      <SmoothExpandable expanded={adaptValueWithCallbacksAsVariableStrategyProps(expanded)}>
        {children}
      </SmoothExpandable>
    </div>
  );
};
