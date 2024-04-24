import { HTMLAttributes, ReactElement, forwardRef, useCallback, useRef } from 'react';
import { useWindowSizeValueWithCallbacks } from '../hooks/useWindowSize';
import { ForwardedRef } from 'react-chartjs-2/dist/types';
import { useValueWithCallbacksEffect } from '../hooks/useValueWithCallbacksEffect';

/**
 * Equivalent to a div, except sets the min-height of the div to the window
 * height via the style attribute. This is preferable to 100vh since
 * visual-height units are essentially broken in order to keep them compatible
 * with safari.
 */
export const FullHeightDiv = forwardRef(
  (
    { children, ...props }: HTMLAttributes<HTMLDivElement>,
    ref: ForwardedRef<HTMLDivElement>
  ): ReactElement => {
    const myRef = useRef<HTMLDivElement | null>();
    const windowSizeVWC = useWindowSizeValueWithCallbacks();

    useValueWithCallbacksEffect(
      windowSizeVWC,
      useCallback((windowSize) => {
        const element = myRef.current;
        if (element === null || element === undefined) {
          return undefined;
        }

        element.style.minHeight = `${windowSize.height}px`;
        return undefined;
      }, [])
    );

    const refHandler = useCallback(
      (element: HTMLDivElement | null) => {
        myRef.current = element;
        if (ref) {
          if (typeof ref === 'function') {
            ref(element);
          } else {
            ref.current = element;
          }
        }
      },
      [ref]
    );

    return (
      <div ref={refHandler} {...props}>
        {children}
      </div>
    );
  }
);
