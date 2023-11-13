import { ReactElement, useCallback, useRef } from 'react';
import {
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { Channel } from './RequestNotificationTimeState';
import { useAnimatedValueWithCallbacks } from '../../../../shared/anim/useAnimatedValueWithCallbacks';
import {
  BezierAnimator,
  BezierColorAnimator,
  DependentAnimator,
  TrivialAnimator,
} from '../../../../shared/anim/AnimationLoop';
import { ease, easeOut, easeOutBack } from '../../../../shared/lib/Bezier';
import { colorToCSS, makeSVGNumber } from '../../../../shared/anim/svgUtils';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import styles from './ChannelIcon.module.css';
import { PartialIconForChannel } from './partialIcons/PartialIconForChannel';
import { nameForChannel } from './formatUtils';

/**
 * The configurable properties when rendering an icon for a channel.
 */
type ChannelAnimationState = {
  /**
   * The first stop color on the background gradient, as 0-1 RGBA.
   */
  backgroundGradientStopColor1: [number, number, number, number];
  /**
   * The second stop color on the background gradient, as 0-1 RGBA.
   */
  backgroundGradientStopColor2: [number, number, number, number];
  /**
   * The stroke color of the actual icon, as 0-1 RGBA.
   */
  iconColor: [number, number, number, number];
  /**
   * The radius of the red dot is scaled by this factor. 1 for normal,
   * 0 for invisible. Negative values are clipped to 0.
   */
  dotScale: number;
  /**
   * Used as a hint to the rendering system for how far into an animation
   * we are, for performance
   */
  progress: number;
  /**
   * A trivially animated value to indicate the direction of the animation,
   * which is used to select the appropriate easing functions.
   */
  direction: number;
  /**
   * The opacity of the label, as a 0-1 value.
   */
  labelOpacity: number;
};

const activeGrad = {
  stop1: [87 / 255, 184 / 255, 162 / 255, 1] as const,
  stop2: [18 / 255, 127 / 255, 125 / 255, 1] as const,
};

const inactiveGrad = {
  stop1: [63 / 255, 72 / 255, 74 / 255, 1] as const,
  stop2: [63 / 255, 72 / 255, 74 / 255, 1] as const,
};

const getTargetChannelIconAnimationState = (active: boolean): ChannelAnimationState => {
  if (active) {
    return {
      backgroundGradientStopColor1: [...activeGrad.stop1],
      backgroundGradientStopColor2: [...activeGrad.stop2],
      iconColor: [1, 1, 1, 1],
      dotScale: 1,
      progress: 1,
      direction: 1,
      labelOpacity: 1,
    };
  } else {
    return {
      backgroundGradientStopColor1: [...inactiveGrad.stop1],
      backgroundGradientStopColor2: [...inactiveGrad.stop2],
      iconColor: [200 / 255, 205 / 255, 208 / 255, 1],
      dotScale: 0,
      progress: 0,
      direction: 0,
      labelOpacity: 0,
    };
  }
};

/**
 * Renders the icon for the given channel. Has two versions for the active and
 * inactive state with a juicy animation between them. Includes a label beneath
 * the icon in the active state.
 */
export const ChannelIcon = ({
  active,
  channel,
}: {
  active: ValueWithCallbacks<boolean>;
  channel: Channel;
}): ReactElement => {
  const colorVWC = useWritableValueWithCallbacks<[number, number, number, number]>(
    () => getTargetChannelIconAnimationState(false).iconColor
  );
  const defsRef = useRef<SVGDefsElement>(null);
  const bkndRef = useRef<SVGRectElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const iconGRef = useRef<SVGGElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const target = useAnimatedValueWithCallbacks(
    () => getTargetChannelIconAnimationState(false),
    () => [
      new BezierColorAnimator(
        ease,
        500,
        (p) => p.backgroundGradientStopColor1,
        (p, v) => (p.backgroundGradientStopColor1 = v)
      ),
      new BezierColorAnimator(
        ease,
        500,
        (p) => p.backgroundGradientStopColor2,
        (p, v) => (p.backgroundGradientStopColor2 = v)
      ),
      new BezierColorAnimator(
        ease,
        500,
        (p) => p.iconColor,
        (p, v) => (p.iconColor = v)
      ),
      new DependentAnimator([
        [
          (v) => v.direction === 1,
          new BezierAnimator(
            easeOutBack,
            800,
            (p) => p.dotScale,
            (p, v) => (p.dotScale = v)
          ),
        ],
        [
          () => true,
          new BezierAnimator(
            ease,
            500,
            (p) => p.dotScale,
            (p, v) => (p.dotScale = v)
          ),
        ],
      ]),
      new BezierAnimator(
        ease,
        500,
        (p) => p.labelOpacity,
        (p, v) => (p.labelOpacity = v)
      ),
      new BezierAnimator(
        easeOut,
        350,
        (p) => p.progress,
        (p, v) => (p.progress = v)
      ),
      new TrivialAnimator('direction'),
    ],
    (val) => {
      const defs = defsRef.current;
      const bknd = bkndRef.current;

      if (defs !== null && bknd !== null) {
        if (defs.children.length === 3) {
          defs.children[2].remove();
        }

        if (val.progress !== 0 && val.progress !== 1) {
          defs.insertAdjacentElement(
            'beforeend',
            (() => {
              const res = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
              res.setAttribute('id', `grad${makeSVGNumber(val.progress)}`);
              res.setAttribute('gradientUnits', 'objectBoundingBox');
              res.setAttribute('x1', '45.77%');
              res.setAttribute('y1', '31.122%');
              res.setAttribute('x2', '75.376%');
              res.setAttribute('y2', '95.651%');
              res.appendChild(
                (() => {
                  const res = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                  res.setAttribute('stop-color', colorToCSS(val.backgroundGradientStopColor1));
                  return res;
                })()
              );
              res.appendChild(
                (() => {
                  const res = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                  res.setAttribute('offset', '1');
                  res.setAttribute('stop-color', colorToCSS(val.backgroundGradientStopColor2));
                  return res;
                })()
              );
              return res;
            })()
          );
        }

        bknd.setAttribute('fill', `url(#grad${makeSVGNumber(val.progress)})`);
      }

      const dot = dotRef.current;
      if (dot !== null) {
        dot.setAttribute('transform', `scale(${makeSVGNumber(Math.max(val.dotScale, 0))})`);
      }

      const iconG = iconGRef.current;
      if (iconG !== null) {
        if (val.progress !== 0 && val.progress !== 1 && val.direction === 1) {
          const additionalScale = Math.sin(val.progress * Math.PI);
          iconG.setAttribute('transform', `scale(${makeSVGNumber(1 + 0.05 * additionalScale)})`);
        } else {
          iconG.removeAttribute('transform');
        }
      }

      const label = labelRef.current;
      if (label !== null) {
        label.style.opacity = `${val.labelOpacity}`;
      }

      setVWC(colorVWC, [...val.iconColor] as [number, number, number, number]);
    }
  );

  useValueWithCallbacksEffect(
    active,
    useCallback(
      (act) => {
        setVWC(target, getTargetChannelIconAnimationState(act));
        return undefined;
      },
      [target]
    )
  );

  return (
    <div className={styles.channel}>
      <svg viewBox="0 -23 128 128" width="93px" height="93px">
        <defs ref={defsRef}>
          <linearGradient
            id="grad0"
            gradientUnits="objectBoundingBox"
            x1="45.77%"
            y1="31.122%"
            x2="75.376%"
            y2="95.651%">
            <stop stopColor={colorToCSS(inactiveGrad.stop1)} />
            <stop offset="1" stopColor={colorToCSS(inactiveGrad.stop2)} />
          </linearGradient>
          <linearGradient
            id="grad1"
            gradientUnits="objectBoundingBox"
            x1="45.77%"
            y1="31.122%"
            x2="75.376%"
            y2="95.651%">
            <stop stopColor={colorToCSS(activeGrad.stop1)} />
            <stop offset="1" stopColor={colorToCSS(activeGrad.stop2)} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="100" rx="10" fill="none" ref={bkndRef} />
        <circle
          cx="99"
          cy="1"
          r="14"
          fill="red"
          transform-origin="99 1"
          transform={`scale(${makeSVGNumber(target.get().dotScale)})`}
          ref={dotRef}
        />
        <g ref={iconGRef} transform-origin="50 50">
          <PartialIconForChannel channel={channel} color={colorVWC} />
        </g>
      </svg>
      <div
        className={styles.channelLabel}
        ref={labelRef}
        style={{ opacity: target.get().labelOpacity }}>
        {nameForChannel(channel, { capitalize: true })}
      </div>
    </div>
  );
};
