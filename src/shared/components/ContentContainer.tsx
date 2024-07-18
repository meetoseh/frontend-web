import { CSSProperties, PropsWithChildren, ReactElement, useEffect } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import styles from './ContentContainer.module.css';
import { useStyleVWC } from '../hooks/useStyleVWC';
import { setVWC } from '../lib/setVWC';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../hooks/useReactManagedValueAsValueWithCallbacks';
import { combineClasses } from '../lib/combineClasses';
import { createValueWithCallbacksEffect } from '../hooks/createValueWithCallbacksEffect';

/**
 * Renders a container with a fixed width matching the suggested width of the
 * content area for an app-like screen. Always displays flex, direction column,
 * align stretch, justify center (by default).
 */
export const ContentContainer = ({
  contentWidthVWC,
  justifyContent,
  alignSelf,
  scrolls,
  children,
  refVWC,
}: PropsWithChildren<
  {
    contentWidthVWC: ValueWithCallbacks<number>;
    alignSelf?: CSSProperties['alignSelf'];
    refVWC?: WritableValueWithCallbacks<HTMLDivElement | null>;
  } & (
    | {
        justifyContent?: CSSProperties['justifyContent'];
        scrolls?: undefined;
      }
    | {
        justifyContent: 'flex-start';
        scrolls: true;
      }
  )
>): ReactElement => {
  const contentRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const contentStyleVWC = useMappedValuesWithCallbacks(
    [contentWidthVWC, useReactManagedValueAsValueWithCallbacks(justifyContent)],
    () => ({
      width: `${contentWidthVWC.get()}px`,
      justifyContent: justifyContent ?? 'center',
      alignSelf: alignSelf ?? 'center',
    })
  );
  useStyleVWC(contentRef, contentStyleVWC);

  useEffect(() => {
    if (refVWC === undefined) {
      return undefined;
    }

    return createValueWithCallbacksEffect(contentRef, (r) => {
      setVWC(refVWC, r);
      return undefined;
    });
  }, [refVWC, contentRef]);

  return (
    <div
      className={combineClasses(styles.container, scrolls ? styles.scrolls : undefined)}
      ref={(r) => setVWC(contentRef, r)}
      style={contentStyleVWC.get()}>
      {children}
    </div>
  );
};
