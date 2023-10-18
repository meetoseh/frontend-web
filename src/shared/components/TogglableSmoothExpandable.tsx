import { PropsWithChildren, ReactElement, useCallback } from 'react';
import styles from './TogglableSmoothExpandable.module.css';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { Button } from '../forms/Button';
import { SmoothExpandable } from './SmoothExpandable';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../lib/adaptValueWithCallbacksAsVariableStrategyProps';

type TogglableSmoothExpandableProps = {
  /**
   * The text to show when the component is collapsed as the call to action
   * to expand the component.
   */
  expandCTA?: string;
  /**
   * The text to show when the component is expanded as the call to action
   * to collapse the component.
   */
  collapseCTA?: string;

  /**
   * If true the animation will be disabled and this is simply a togglable
   * expandable.
   */
  noAnimate?: boolean;
};
/**
 * A basic component which has a show/hide button to expand/collapse the
 * component.
 */
export const TogglableSmoothExpandable = ({
  expandCTA = 'Show more',
  collapseCTA = 'Hide',
  noAnimate,
  children,
}: PropsWithChildren<TogglableSmoothExpandableProps>): ReactElement => {
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
          component={(expanded) => (expanded ? <>{collapseCTA}</> : <>{expandCTA}</>)}
        />
      </Button>
      {noAnimate ? (
        <RenderGuardedComponent
          props={expanded}
          component={(expanded) => (expanded ? <>{children}</> : <></>)}
        />
      ) : (
        <SmoothExpandable expanded={adaptValueWithCallbacksAsVariableStrategyProps(expanded)}>
          {children}
        </SmoothExpandable>
      )}
    </div>
  );
};
