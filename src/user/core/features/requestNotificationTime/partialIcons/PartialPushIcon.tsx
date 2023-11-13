import { ReactElement, useCallback, useRef } from 'react';
import { PartialIconProps } from './PartialIconProps';
import { colorToCSS, makeSVGNumber } from '../../../../../shared/anim/svgUtils';
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';

/**
 * Renders an animatable icon representing our app, when placed within an
 * SVG element. The icon is centered at (50, 50) and is sized to fit a 100x100
 * viewBox.
 */
export const PartialPushIcon = ({ color }: PartialIconProps): ReactElement => {
  const svgn = makeSVGNumber;
  const gRef = useRef<SVGGElement>(null);

  useValueWithCallbacksEffect(
    color,
    useCallback((c) => {
      const g = gRef.current;
      if (g === null) {
        return undefined;
      }

      g.setAttribute('stroke', colorToCSS(c));
    }, [])
  );

  return (
    <g
      transform={`translate(25, 25), scale(${svgn(50 / 183.65)}, ${svgn(50 / 183.65)})`}
      strokeLinecap="round"
      strokeMiterlimit="10"
      strokeWidth={svgn(183.65 * 0.04)}
      fill="none">
      <g stroke={colorToCSS(color.get())} ref={gRef}>
        <circle cx="66.7" cy="106.97" r="64.2" />
        <path
          d="M131.84,184.65a66.24,66.24,0,0,1-11-63.33C128.41,100,147.24,84,169.33,79.47a65.09,65.09,0,0,1,32.54,125.86,66,66,0,0,1-8,2"
          transform="translate(-66.14 -75.67)"
        />
      </g>
    </g>
  );
};
