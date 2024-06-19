import { ReactElement, useCallback, useRef } from 'react';
import { PartialIconProps } from './PartialIconProps';
import { colorToCSS, makeLinePath, makeSVGNumber } from '../../../../../shared/anim/svgUtils';
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';

/**
 * Renders an animatable icon representing an email app, when placed within an
 * SVG element.  The icon is centered at (50, 50) and is sized to fit a 100x100
 * viewBox.
 */
export const PartialEmailIcon = ({ color }: PartialIconProps): ReactElement => {
  const xPad = 28.5;
  const width = 100 - xPad * 2;
  const yPad = 35;
  const height = 100 - yPad * 2;
  const strokeWidth = 2;
  const radius = 2;

  const svgn = makeSVGNumber;
  const rectRef = useRef<SVGRectElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useValueWithCallbacksEffect(
    color,
    useCallback((c) => {
      const rect = rectRef.current;
      const path = pathRef.current;

      if (rect === null || path === null) {
        return undefined;
      }

      rect.setAttribute('stroke', colorToCSS(c));
      path.setAttribute('stroke', colorToCSS(c));
    }, [])
  );

  return (
    <>
      <rect
        x={svgn(xPad)}
        y={svgn(yPad)}
        width={svgn(width)}
        height={svgn(height)}
        stroke={colorToCSS(color.get())}
        strokeWidth={svgn(strokeWidth)}
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        rx={svgn(radius)}
        fill="none"
        ref={rectRef}
      />
      <mask id="emailInnerMask">
        <rect width="100%" height="100%" fill="black" />
        <rect
          x={svgn(xPad)}
          y={svgn(yPad)}
          width={svgn(width)}
          height={svgn(height)}
          rx={svgn(radius)}
          fill="white"
        />
      </mask>

      <path
        d={makeLinePath([xPad, yPad, xPad + 0.5 * width, yPad + 0.6 * height, xPad + width, yPad])}
        stroke={colorToCSS(color.get())}
        strokeWidth={svgn(strokeWidth)}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        mask="url(#emailInnerMask)"
        ref={pathRef}
      />
    </>
  );
};
