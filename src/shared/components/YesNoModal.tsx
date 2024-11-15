import { ReactElement, useCallback, useRef } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { combineClasses } from '../lib/combineClasses';
import { setVWC } from '../lib/setVWC';
import { InlineOsehSpinner } from './InlineOsehSpinner';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import styles from './YesNoModal.module.css';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';
import { useAnimatedValueWithCallbacks } from '../anim/useAnimatedValueWithCallbacks';
import { BezierAnimator } from '../anim/AnimationLoop';
import { ease } from '../lib/Bezier';
import { useTimedValueWithCallbacks } from '../hooks/useTimedValue';

export type YesNoModalProps = {
  title: string;
  body: string;
  cta1: string;
  cta2?: string;
  emphasize: 1 | 2 | null;
  /**
   * Strings are treated as URLs to navigate to, functions are
   * treated as async callbacks to execute
   */
  onClickOne: string | (() => Promise<void>);
  /**
   * Strings are treated as URLs to navigate to, functions are
   * treated as async callbacks to execute
   */
  onClickTwo?: string | (() => Promise<void>);
  /**
   * Called after the modal has been dismissed and all animations
   * have been played, so the modal can be removed from the DOM
   */
  onDismiss: () => void;
  requestDismiss: WritableValueWithCallbacks<() => void>;
};

/**
 * Shows a simple yes/no modal, including the required wrapper to
 * fade out the background and allow dismissing by clicking outside
 */
export const YesNoModal = ({
  title,
  body,
  cta1,
  cta2,
  onClickOne,
  onClickTwo,
  onDismiss,
  requestDismiss,
  emphasize,
}: YesNoModalProps): ReactElement => {
  const executingOne = useWritableValueWithCallbacks(() => false);
  const executingTwo = useWritableValueWithCallbacks(() => false);
  const visible = useWritableValueWithCallbacks(() => true);
  const fadingOut = useWritableValueWithCallbacks(() => false);
  const clickthroughPrevention = useTimedValueWithCallbacks(true, false, 500);

  const startDismiss = useCallback(() => {
    setVWC(visible, false);
  }, [visible]);
  setVWC(requestDismiss, startDismiss, (a, b) => a === b);

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useValueWithCallbacksEffect(
    visible,
    useCallback(
      (v) => {
        if (v) {
          setVWC(fadingOut, false);
          return undefined;
        }

        setVWC(fadingOut, true);
        let timeout: NodeJS.Timeout | null = null;
        const onTimeout = () => {
          timeout = null;
          onDismissRef.current();
        };
        timeout = setTimeout(onTimeout, 350);
        return () => {
          if (timeout !== null) {
            clearTimeout(timeout);
          }
        };
      },
      [fadingOut]
    )
  );

  const handleClickOne = useCallback((): void => {
    if (
      executingOne.get() ||
      executingTwo.get() ||
      clickthroughPrevention.get() ||
      typeof onClickOne !== 'function'
    ) {
      return;
    }

    setVWC(executingOne, true);
    onClickOne().finally(() => {
      setVWC(executingOne, false);
    });
  }, [executingOne, executingTwo, clickthroughPrevention, onClickOne]);

  const handleClickTwo = useCallback((): void => {
    if (
      executingOne.get() ||
      executingTwo.get() ||
      clickthroughPrevention.get() ||
      onClickTwo === undefined ||
      typeof onClickTwo !== 'function'
    ) {
      return;
    }

    setVWC(executingTwo, true);
    onClickTwo().finally(() => {
      setVWC(executingTwo, false);
    });
  }, [executingOne, executingTwo, clickthroughPrevention, onClickTwo]);

  return (
    <Inner
      title={title}
      body={body}
      cta1={cta1}
      cta2={cta2}
      emphasize={emphasize}
      onClickOne={typeof onClickOne === 'string' ? onClickOne : handleClickOne}
      onClickTwo={typeof onClickTwo === 'string' ? onClickTwo : handleClickTwo}
      onDismiss={startDismiss}
      fadingOut={fadingOut}
      executingOne={executingOne}
      executingTwo={executingTwo}
    />
  );
};

type InnerProps = {
  title: string;
  body: string;
  cta1: string;
  cta2?: string;
  emphasize: 1 | 2 | null;
  onClickOne: string | (() => void);
  onClickTwo?: string | (() => void);
  onDismiss: () => void;
  fadingOut: ValueWithCallbacks<boolean>;
  executingOne: ValueWithCallbacks<boolean>;
  executingTwo: ValueWithCallbacks<boolean>;
};

type AnimationState = {
  backgroundOpacity: number;
  foregroundOpacity: number;
  contentOffsetY: number;
};
const hiddenAnimationState = (): AnimationState => ({
  backgroundOpacity: 0,
  foregroundOpacity: 0,
  contentOffsetY: 50,
});
const shownAnimationState = (): AnimationState => ({
  backgroundOpacity: 0.9,
  foregroundOpacity: 1,
  contentOffsetY: 0,
});

const Inner = ({
  title,
  body,
  cta1,
  cta2,
  emphasize,
  onClickOne,
  onClickTwo,
  onDismiss,
  fadingOut,
  executingOne,
  executingTwo,
}: InnerProps): ReactElement => {
  const handleClickOne = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      if (typeof onClickOne === 'function') {
        onClickOne();
      }
    },
    [onClickOne]
  );

  const handleClickTwo = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      if (typeof onClickTwo === 'function') {
        onClickTwo();
      }
    },
    [onClickTwo]
  );

  const rendered = useWritableValueWithCallbacks<AnimationState>(hiddenAnimationState);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const target = useAnimatedValueWithCallbacks(
    hiddenAnimationState,
    () => [
      new BezierAnimator(
        ease,
        350,
        (p) => p.backgroundOpacity,
        (p, v) => (p.backgroundOpacity = v)
      ),
      new BezierAnimator(
        ease,
        350,
        (p) => p.foregroundOpacity,
        (p, v) => (p.foregroundOpacity = v)
      ),
      new BezierAnimator(
        ease,
        350,
        (p) => p.contentOffsetY,
        (p, v) => (p.contentOffsetY = v)
      ),
    ],
    (val) => {
      const container = containerRef.current;
      if (container !== null) {
        container.style.background = `rgba(0, 0, 0, ${val.backgroundOpacity})`;
      }

      const content = contentRef.current;
      if (content !== null) {
        content.style.opacity = `${val.foregroundOpacity}`;
        content.style.top = `${val.contentOffsetY}px`;
      }
    },
    rendered
  );

  useValueWithCallbacksEffect(fadingOut, (hidden) => {
    if (hidden) {
      setVWC(target, hiddenAnimationState());
    } else {
      setVWC(target, shownAnimationState());
    }
    return undefined;
  });

  const className1 = combineClasses(
    styles.button,
    emphasize === 1 ? styles.emphasizeButton : undefined,
    executingOne.get() ? styles.executing : undefined,
    executingTwo.get() ? styles.disabled : undefined
  );

  const className2 = combineClasses(
    styles.button,
    emphasize === 2 ? styles.emphasizeButton : undefined,
    executingTwo.get() ? styles.executing : undefined,
    executingOne.get() ? styles.disabled : undefined
  );

  return (
    <div
      className={styles.container}
      style={{
        background: `rgba(0, 0, 0, ${rendered.get().backgroundOpacity})`,
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }}
      ref={containerRef}>
      <div
        className={styles.content}
        style={{
          opacity: `${rendered.get().foregroundOpacity}`,
          top: `${rendered.get().contentOffsetY}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        ref={contentRef}>
        <div className={styles.title}>{title}</div>
        <div className={styles.body}>{body}</div>
        <div className={styles.buttons}>
          {typeof onClickOne === 'function' ? (
            <button type="button" className={className1} onClick={handleClickOne}>
              <RenderGuardedComponent
                props={executingOne}
                component={(v) => (
                  <>
                    {v && (
                      <div className={styles.spinnerContainer}>
                        <InlineOsehSpinner
                          size={{ type: 'react-rerender', props: { height: 16 } }}
                          variant="black"
                        />
                      </div>
                    )}
                    {v && <>Working...</>}
                    {!v && cta1}
                  </>
                )}
              />
            </button>
          ) : (
            <a href={onClickOne} className={className1}>
              {cta1}
            </a>
          )}
          {cta2 &&
            (typeof onClickTwo === 'function' ? (
              <button type="button" className={className2} onClick={handleClickTwo}>
                <RenderGuardedComponent
                  props={executingTwo}
                  component={(v) => (
                    <>
                      {v && (
                        <div className={styles.spinnerContainer}>
                          <InlineOsehSpinner
                            size={{ type: 'react-rerender', props: { height: 14 } }}
                            variant="black"
                          />
                        </div>
                      )}
                      {v && <>Working...</>}
                      {!v && cta2}
                    </>
                  )}
                />
              </button>
            ) : (
              <a href={onClickTwo} className={className2}>
                {cta2}
              </a>
            ))}
        </div>
      </div>
    </div>
  );
};
