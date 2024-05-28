import { ReactElement, useEffect, useRef } from 'react';
import { InlineOsehSpinner } from '../components/InlineOsehSpinner';
import styles from './IconButtonWithLabel.module.css';
import {
  ValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { createValuesWithCallbacksEffect } from '../hooks/createValuesWithCallbacksEffect';
import { createValueWithCallbacksEffect } from '../hooks/createValueWithCallbacksEffect';
import { alphaBlend } from '../lib/colorUtils';

export type IconButtonWithLabelProps = {
  /**
   * The icon to display, as a class name that can be applied to a div or
   * a react element
   */
  iconClass: string | ReactElement;

  /**
   * The label to display
   */
  label: string;

  /**
   * If the button is disabled, ignored for anchor elements
   */
  disabled?: boolean;

  /**
   * Called when the button is clicked. Can be a string to be treated as a url
   */
  onClick?: React.MouseEventHandler<HTMLButtonElement> | string | undefined;

  /**
   * Ignored unless onClick is a string. Called when the link is clicked,
   * when the user is already being navigated to the link
   */
  onLinkClick?: ((this: HTMLAnchorElement, ev: MouseEvent) => void) | undefined;

  /**
   * If true, a spinner is displayed instead of the icon
   */
  spinner?: boolean;

  /**
   * If specified we can avoid using a blur/opacity (slow on android) and
   * instead use a fixed color based on the average background color.
   */
  averageBackgroundColor?: ValueWithCallbacks<[number, number, number] | null>;
};

export const IconButtonWithLabel = ({
  iconClass,
  label,
  disabled,
  onClick,
  onLinkClick,
  spinner,
  averageBackgroundColor,
}: IconButtonWithLabelProps): ReactElement => {
  const anchorRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (
      anchorRef.current === null ||
      anchorRef.current === undefined ||
      onLinkClick === undefined
    ) {
      return;
    }
    const anchor = anchorRef.current;
    anchor.addEventListener('click', onLinkClick, false);
    return () => {
      anchor.removeEventListener('click', onLinkClick, false);
    };
  }, [onLinkClick]);

  const contentRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useEffect(() => {
    if (averageBackgroundColor === undefined) {
      return createValueWithCallbacksEffect(contentRef, (ele) => {
        if (ele !== null) {
          ele.classList.add(styles.iconContainerAutoBackground);
          ele.removeAttribute('style');
        }
        return undefined;
      });
    }
    const avgBkndVWC = averageBackgroundColor;
    return createValuesWithCallbacksEffect([avgBkndVWC, contentRef], () => {
      const eleRaw = contentRef.get();
      if (eleRaw === null) {
        return undefined;
      }
      const ele = eleRaw;

      const avgBknd = avgBkndVWC.get();
      if (avgBknd === null) {
        ele.classList.add(styles.iconContainerAutoBackground);
        ele.removeAttribute('style');
        return undefined;
      }

      const hoverVWC = createWritableValueWithCallbacks(false);
      const cleanupHover = ((): (() => void) => {
        try {
          setVWC(hoverVWC, ele.matches(':hover'));
        } catch (e) {
          console.log('failed to init hover state:', e);
        }

        ele.addEventListener('mouseenter', onMouseEnter);
        ele.addEventListener('mouseleave', onMouseLeave);
        return () => {
          ele.removeEventListener('mouseenter', onMouseEnter);
          ele.removeEventListener('mouseleave', onMouseLeave);
        };
        function onMouseEnter() {
          setVWC(hoverVWC, true);
        }
        function onMouseLeave() {
          setVWC(hoverVWC, false);
        }
      })();

      const pressVWC = createWritableValueWithCallbacks(false);
      const cleanupPress = ((): (() => void) => {
        try {
          // won't catch holding elsewhere then mouseenter, but close enough
          setVWC(pressVWC, ele.matches(':active'));
        } catch (e) {
          console.log('failed to init press state:', e);
        }

        ele.addEventListener('mousedown', onMouseDown);
        ele.addEventListener('mouseup', onMouseUp);
        return () => {
          ele.removeEventListener('mousedown', onMouseDown);
          ele.removeEventListener('mouseup', onMouseUp);
        };
        function onMouseDown() {
          setVWC(pressVWC, true);
        }
        function onMouseUp() {
          setVWC(pressVWC, false);
        }
      })();

      ele.classList.remove(styles.iconContainerAutoBackground);
      const normalBackground = alphaBlend(avgBknd, [1, 1, 1, 0.15]);
      const hoverBackground = alphaBlend(avgBknd, [1, 1, 1, 0.3]);
      const pressBackground = alphaBlend(avgBknd, [1, 1, 1, 0.45]);

      const cleanupSetStyle = createValuesWithCallbacksEffect([hoverVWC, pressVWC], () => {
        const hover = hoverVWC.get();
        const press = pressVWC.get();
        const background = press ? pressBackground : hover ? hoverBackground : normalBackground;
        ele.style.backgroundColor = `rgb(${background[0] * 255}, ${background[1] * 255}, ${
          background[2] * 255
        })`;
        return () => {
          ele.removeAttribute('style');
        };
      });
      return () => {
        cleanupHover();
        cleanupPress();
        cleanupSetStyle();
      };
    });
  }, [averageBackgroundColor, contentRef]);

  const contents = (
    <>
      <div className={styles.iconContainer} ref={(r) => setVWC(contentRef, r)}>
        {spinner ? (
          <InlineOsehSpinner
            size={{
              type: 'react-rerender',
              props: {
                width: 20,
              },
            }}
          />
        ) : typeof iconClass === 'string' ? (
          <div className={iconClass} />
        ) : (
          iconClass
        )}
      </div>
      <div className={styles.label}>{label}</div>
    </>
  );

  if (onClick === undefined || typeof onClick === 'function') {
    return (
      <button type="button" className={styles.button} onClick={onClick} disabled={disabled}>
        {contents}
      </button>
    );
  }

  return (
    <a href={onClick} className={styles.button} ref={anchorRef}>
      {contents}
    </a>
  );
};
