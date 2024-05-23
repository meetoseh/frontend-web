import { CSSProperties, PropsWithChildren, ReactElement } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import styles from './ContentContainer.module.css';
import { useStyleVWC } from '../hooks/useStyleVWC';
import { setVWC } from '../lib/setVWC';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../hooks/useReactManagedValueAsValueWithCallbacks';

/**
 * Renders a container with a fixed width matching the suggested width of the
 * content area for an app-like screen. Always displays flex, direction column,
 * align stretch, justify center (by default).
 */
export const ContentContainer = ({
  contentWidthVWC,
  justifyContent,
  children,
}: PropsWithChildren<{
  contentWidthVWC: ValueWithCallbacks<number>;
  justifyContent?: CSSProperties['justifyContent'];
}>): ReactElement => {
  const contentRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const contentStyleVWC = useMappedValuesWithCallbacks(
    [contentWidthVWC, useReactManagedValueAsValueWithCallbacks(justifyContent)],
    () => ({
      width: `${contentWidthVWC.get()}px`,
      justifyContent: justifyContent ?? 'center',
    })
  );
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
