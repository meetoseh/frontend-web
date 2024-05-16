import { PropsWithChildren, ReactElement } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import styles from './ContentContainer.module.css';
import { useStyleVWC } from '../hooks/useStyleVWC';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { setVWC } from '../lib/setVWC';

/**
 * Renders a container with a fixed width matching the suggested width of the
 * content area for an app-like screen. Always displays flex, direction column,
 * align stretch, justify start.
 */
export const ContentContainer = ({
  contentWidthVWC,
  children,
}: PropsWithChildren<{
  contentWidthVWC: ValueWithCallbacks<number>;
}>): ReactElement => {
  const contentRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const contentStyleVWC = useMappedValueWithCallbacks(contentWidthVWC, (cw) => ({
    width: `${cw}px`,
  }));
  useStyleVWC(contentRef, contentStyleVWC);

  return (
    <div
      className={styles.container}
      ref={(r) => setVWC(contentRef, r)}
      style={contentStyleVWC.get()}>
      {children}
    </div>
  );
};
