import { PropsWithChildren, ReactElement, useCallback, useEffect, useRef } from 'react';
import {
  Callbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import styles from './SlideInModal.module.css';
import { useAnimatedValueWithCallbacks } from '../anim/useAnimatedValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../hooks/useWindowSize';
import { BezierAnimator, DependentAnimator, TrivialAnimator } from '../anim/AnimationLoop';
import { ease, easeInOutBack, linear } from '../lib/Bezier';
import { setVWC } from '../lib/setVWC';
import { useValuesWithCallbacksEffect } from '../hooks/useValuesWithCallbacksEffect';
import assistiveStyles from '../assistive.module.css';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';

type SlideInModalProps = {
  /** The title for the modal */
  title: string;

  /**
   * Called after the user clicks the x or the background to close the modal
   * and all animations for closing the modal have completed.
   */
  onClosed: () => void;

  /**
   * Called potentially multiple times whenever the closing animation begins.
   * Not guarranteed to be called before onClosed.
   */
  onClosing?: () => void;

  /**
   * Updated witha callback that plays the closing animation and then calls
   * onClosed when finished
   */
  requestClose?: WritableValueWithCallbacks<() => void>;

  /**
   * If specified, we write true to this value while we
   * are animating the component or the user is dragging.
   * Can be used to disable components or scrolling to
   * improve performance.
   */
  animating?: WritableValueWithCallbacks<boolean>;
};

type _AnimationState = {
  /** Opacity of the background element; a higher opacity results in more dimming */
  backgroundOpacity: number;
  /**
   * Where the top of the modal should be in pixels, where a lower value covers more of the
   * screen
   */
  innerContainerTop: number;
  /**
   * A trivially animated element so that the renderer knows generally what we're
   * currently doing for e.g. choosing animations. One of:
   * - `drag`: The target matches where the user was dragging the modal. Progress will be
   *   between 0 and 1 to reflect the % of the inner content below the bottom of the screen.
   * - 'open': The target is the fully open case. Progress will be `1` when done
   * - 'close': The target is the fully closed state. Progress will be `0` when done
   */
  state: 'drag' | 'open' | 'close';
  /**
   * A linearly interpolated progress value to allow determining if we're
   * currently animating
   */
  progress: number;
};

type Cancelable = { stopPropagation?: () => void; preventDefault?: () => void };

const OPEN_BACKGROUND_OPACITY = 0.9;
const DRAG_BACKGROUND_OPACITY = 0.5;

/**
 * A container which, when added to the DOM, slides up form the bottom.
 * The user can dismiss the container either by clicking above the
 * container or by clicking a close button
 *
 * When the container is fully open, the background is heavily dimmed.
 * While the user is dragging the dimming is reduced to allow them to
 * see the content behind the container.
 */
export const SlideInModal = ({
  title,
  onClosed,
  onClosing,
  requestClose,
  animating,
  children,
}: PropsWithChildren<SlideInModalProps>): ReactElement => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const requestedCloseRef = useRef(false);
  const inDragCloseCooldown = useRef(false);

  // null if we don't know the inner container height, otherwise the height in
  // pixels of the inner container.
  const innerContainerHeight = useWritableValueWithCallbacks<number | null>(() => null);

  const animationTarget = useAnimatedValueWithCallbacks<_AnimationState>(
    () => ({
      backgroundOpacity: 0,
      innerContainerTop: windowSizeVWC.get().height,
      state: 'open',
      progress: 0,
    }),
    () => [
      new TrivialAnimator('state'),
      new BezierAnimator(
        ease,
        350,
        (s) => s.backgroundOpacity,
        (s, v) => (s.backgroundOpacity = v)
      ),
      new DependentAnimator([
        [
          (s) => s.state !== 'drag',
          new BezierAnimator(
            easeInOutBack,
            500,
            (s) => s.innerContainerTop,
            (s, v) => (s.innerContainerTop = v),
            {
              onTargetChange: 'replace',
            }
          ),
        ],
        [() => true, new TrivialAnimator('innerContainerTop')],
      ]),
      new BezierAnimator(
        linear,
        500,
        (s) => s.progress,
        (s, v) => (s.progress = v)
      ),
    ],
    (val) => {
      if (animating !== undefined) {
        setVWC(animating, val.state === 'drag' || val.progress !== 1);
      }

      const outer = outerRef.current;
      if (outer !== null) {
        outer.style.backgroundColor = `rgba(0, 0, 0, ${val.backgroundOpacity})`;
      }

      const inner = innerRef.current;
      if (inner !== null) {
        inner.style.top = `${val.innerContainerTop}px`;
      }

      if (val.state === 'close' && val.progress === 0 && !requestedCloseRef.current) {
        requestedCloseRef.current = true;
        onClosed();
      }
    }
  );

  const onClosingRef = useRef(onClosing);
  onClosingRef.current = onClosing;

  const closeModal = useCallback(() => {
    if (inDragCloseCooldown.current) {
      return;
    }

    const target = animationTarget.get();
    if (target.state === 'close') {
      return;
    }

    onClosingRef.current?.();
    setVWC(animationTarget, {
      ...target,
      state: 'close' as 'close',
      backgroundOpacity: 0,
      innerContainerTop: windowSizeVWC.get().height,
      progress: 0,
    });
  }, [animationTarget, windowSizeVWC]);

  if (requestClose !== undefined) {
    setVWC(requestClose, closeModal);
  }

  const handleOuterClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      closeModal();
    },
    [closeModal]
  );

  const handleInnerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  const handleCloseClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    },
    [closeModal]
  );

  // Keeps inner container height up-to-date.  We will cap the inner container at 80%
  // the window height; if it exceeds that, we set the height directly and enable scrolling
  useEffect(() => {
    if (innerRef.current === null) {
      setVWC(innerContainerHeight, null);
      return;
    }

    const inner = innerRef.current;

    let active = true;
    const cancelers = new Callbacks<undefined>();
    manageHeight();
    return () => {
      active = false;
      cancelers.call(undefined);
    };

    function manageHeight() {
      if (!active) {
        return;
      }

      updateHeight();

      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          if (!active) {
            ro.disconnect();
          } else {
            updateHeight();
          }
        });

        ro.observe(inner);
        cancelers.add(() => ro.disconnect());
        if (!active) {
          ro.disconnect();
        }
      } else {
        let debounceTimeout: NodeJS.Timeout | null = null;
        cancelers.add(() => {
          if (debounceTimeout !== null) {
            clearTimeout(debounceTimeout);
            debounceTimeout = null;
          }
        });
        const onDebounce = () => {
          debounceTimeout = null;
          updateHeight();
        };

        const updateHeightAfterDebounce = () => {
          if (!active) {
            return;
          }

          if (debounceTimeout !== null) {
            clearTimeout(debounceTimeout);
          }
          debounceTimeout = setTimeout(onDebounce, 100);
        };

        let recurringTimeout: NodeJS.Timeout | null = null;
        cancelers.add(() => {
          if (recurringTimeout !== null) {
            clearTimeout(recurringTimeout);
            recurringTimeout = null;
          }
        });
        const onRecurringTimeout = () => {
          recurringTimeout = null;
          if (!active) {
            return;
          }
          if (!document.hidden) {
            updateHeightAfterDebounce();
          }
          recurringTimeout = setTimeout(onRecurringTimeout, 1000);
        };
        recurringTimeout = setTimeout(onRecurringTimeout, 1000);

        const onWindowResize = () => {
          if (!active) {
            window.removeEventListener('resize', onWindowResize);
          } else {
            updateHeightAfterDebounce();
          }
        };

        window.addEventListener('resize', onWindowResize);
        cancelers.add(() => window.removeEventListener('resize', onWindowResize));
        if (!active) {
          window.removeEventListener('resize', onWindowResize);
        }
      }
    }

    function updateHeight() {
      if (!active) {
        return;
      }

      const realHeight = inner.scrollHeight;
      const windowHeight = windowSizeVWC.get().height;

      const maxHeight = Math.floor(windowHeight * 0.8);

      if (realHeight <= maxHeight) {
        inner.style.maxHeight = 'none';
        inner.style.overflowY = 'hidden';
        setVWC(innerContainerHeight, inner.offsetHeight);
      } else {
        inner.style.maxHeight = `${maxHeight}px`;
        inner.style.overflowY = 'auto';
        setVWC(innerContainerHeight, maxHeight);
      }
    }
  }, [innerContainerHeight, windowSizeVWC]);

  // When the window size changes, make sure it's reflected in the outer container
  // (VH doesn't work properly due to safari).
  useValueWithCallbacksEffect(
    windowSizeVWC,
    useCallback((windowSize) => {
      const outer = outerRef.current;
      if (outer !== null) {
        outer.style.width = `${windowSize.width}px`;
        outer.style.height = `${windowSize.height}px`;
      }
      return undefined;
    }, [])
  );

  // When the target state is open and the inner container size changes, update
  // the target inner container top.
  useValuesWithCallbacksEffect(
    [animationTarget, innerContainerHeight, windowSizeVWC],
    useCallback(() => {
      const target = animationTarget.get();
      if (target.state !== 'open') {
        return undefined;
      }

      const height = innerContainerHeight.get();
      if (height !== null) {
        const windowHeight = windowSizeVWC.get().height;
        const correctTop = windowHeight - height;
        if (correctTop !== target.innerContainerTop) {
          setVWC(animationTarget, {
            ...target,
            innerContainerTop: correctTop,
            backgroundOpacity: OPEN_BACKGROUND_OPACITY,
            progress: 1,
          });
        }
      }
    }, [animationTarget, innerContainerHeight, windowSizeVWC])
  );

  const startDragging = useCallback(
    (e: Cancelable, x: number, y: number) => {
      if (inDragCloseCooldown.current) {
        return;
      }

      const target = animationTarget.get();
      if (target.state !== 'open') {
        return;
      }

      if (
        headerRef.current === null ||
        innerRef.current === null ||
        closeButtonRef.current === null
      ) {
        return;
      }
      const header = headerRef.current;
      const closeButton = closeButtonRef.current;
      const inner = innerRef.current;

      const headerBoundingRect = header.getBoundingClientRect();
      if (!checkRectPointHit(headerBoundingRect, x, y)) {
        return;
      }

      const closeButtonBoundingRect = closeButton.getBoundingClientRect();
      if (checkRectPointHit(closeButtonBoundingRect, x, y)) {
        return;
      }

      const innerBoundingRect = inner.getBoundingClientRect();
      const windowHeight = windowSizeVWC.get().height;

      const realTop = innerBoundingRect.top;
      const distanceFromBottom = windowHeight - realTop;
      const realProgress = distanceFromBottom / (innerBoundingRect.height || 1);

      inDragCloseCooldown.current = true;
      setVWC(animationTarget, {
        ...target,
        state: 'drag' as 'drag',
        innerContainerTop: realTop,
        backgroundOpacity: DRAG_BACKGROUND_OPACITY,
        progress: realProgress,
      });
    },
    [animationTarget, windowSizeVWC]
  );

  const handleOuterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      startDragging(e, e.clientX, e.clientY);
    },
    [startDragging]
  );

  const handleOuterTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      startDragging(e, e.touches[0].clientX, e.touches[0].clientY);
    },
    [startDragging]
  );

  const continueDragTo = useCallback(
    (e: Cancelable, newTop: number) => {
      const target = animationTarget.get();
      if (target.state !== 'drag') {
        return;
      }

      const height = innerContainerHeight.get();
      if (height === null) {
        return;
      }

      const distanceFromBottom = windowSizeVWC.get().height - newTop;
      const realProgress = distanceFromBottom / (height || 1);

      setVWC(animationTarget, {
        ...target,
        innerContainerTop: newTop,
        progress: realProgress,
      });
    },
    [windowSizeVWC, innerContainerHeight, animationTarget]
  );

  const handleOuterPointerMoveCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      continueDragTo(e, e.clientY);
    },
    [continueDragTo]
  );

  const handleOuterTouchMoveCapture = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      continueDragTo(e, e.touches[0].clientY);
    },
    [continueDragTo]
  );

  const finishDrag = useCallback(
    (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      const target = animationTarget.get();
      if (target.state !== 'drag') {
        return;
      }

      setTimeout(() => {
        inDragCloseCooldown.current = false;
      }, 1000);

      e.stopPropagation();
      e.preventDefault();

      setVWC(animationTarget, {
        ...target,
        state: 'open' as 'open',
        backgroundOpacity: OPEN_BACKGROUND_OPACITY,
        innerContainerTop: windowSizeVWC.get().height - (innerContainerHeight.get() || 0),
        progress: 1,
      });
    },
    [animationTarget, windowSizeVWC, innerContainerHeight]
  );

  const handleOuterPointerUpCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finishDrag(e);
    },
    [finishDrag]
  );

  const handleOuterTouchEndCapture = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      finishDrag(e);
    },
    [finishDrag]
  );

  return (
    <div
      className={styles.outerContainer}
      onClick={handleOuterClick}
      onPointerDown={handleOuterPointerDown}
      onTouchStart={handleOuterTouchStart}
      onPointerMoveCapture={handleOuterPointerMoveCapture}
      onTouchMoveCapture={handleOuterTouchMoveCapture}
      onPointerUpCapture={handleOuterPointerUpCapture}
      onTouchEndCapture={handleOuterTouchEndCapture}
      ref={outerRef}>
      <div className={styles.innerContainer} onClick={handleInnerClick} ref={innerRef}>
        <div className={styles.header} ref={headerRef}>
          <div className={styles.handle} />
          <div className={styles.title}>{title}</div>
        </div>
        <div className={styles.closeContainer}>
          <button
            type="button"
            onClick={handleCloseClick}
            className={styles.closeButton}
            ref={closeButtonRef}>
            <div className={assistiveStyles.srOnly}>Close</div>
            <div className={styles.closeIcon} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
};

const checkRectPointHit = (rect: DOMRect, x: number, y: number) =>
  rect.left <= x && rect.right >= x && rect.top <= y && rect.bottom >= y;
