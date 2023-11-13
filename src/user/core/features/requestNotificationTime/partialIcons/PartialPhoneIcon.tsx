import { ReactElement, useCallback, useRef } from 'react';
import { PartialIconProps } from './PartialIconProps';
import { colorToCSS, makeSVGNumber } from '../../../../../shared/anim/svgUtils';
import { useValueWithCallbacksEffect } from '../../../../../shared/hooks/useValueWithCallbacksEffect';

/**
 * Renders an animatable icon representing an SMS app, when placed within an
 * SVG element.  The icon is centered at (50, 50) and is sized to fit a 100x100
 * viewBox.
 */
export const PartialPhoneIcon = ({ color }: PartialIconProps): ReactElement => {
  const ellipse = {
    cx: 50,
    cy: 45,
    rx: 23.75,
    ry: 20.9,
  } as const;
  const strokeWidth = 2;
  const svgn = makeSVGNumber;
  const pathPoints = [
    ['M', 36.7, 71.85],
    ['Q', 42.4, 66.15, 40.5, 59.5],
    ['L', 51.9, 62.35],
    ['Q', 51.9, 70.9, 36.7, 71.85],
    ['z'],
  ];
  const pathData = (() => {
    const xShift = -5;
    const yShift = 0;

    const parts: string[] = [];
    for (let i = 0; i < pathPoints.length; i++) {
      if (i !== 0) {
        parts.push(' ');
      }
      const pt = pathPoints[i] as (string | number)[];
      parts.push(pt[0] as string);
      for (let ptIndex = 1; ptIndex < pt.length; ptIndex += 2) {
        if (ptIndex !== 1) {
          parts.push(' ');
        }
        parts.push(svgn((pt[ptIndex] as number) + xShift));
        parts.push(' ');
        parts.push(svgn((pt[ptIndex + 1] as number) + yShift));
      }
    }
    return parts.join('');
  })();

  const ellipseRef = useRef<SVGEllipseElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useValueWithCallbacksEffect(
    color,
    useCallback((c) => {
      const ellipse = ellipseRef.current;
      const path = pathRef.current;

      if (ellipse === null || path === null) {
        return undefined;
      }

      ellipse.setAttribute('stroke', colorToCSS(c));
      path.setAttribute('stroke', colorToCSS(c));
    }, [])
  );

  return (
    <>
      <mask id="ellipseMask">
        <rect fill="white" width="100%" height="100%" />
        <path
          d={pathData}
          fill="black"
          stroke="white"
          strokeWidth={svgn(strokeWidth)}
          strokeMiterlimit="10"
          strokeLinejoin="round"
        />
      </mask>
      <ellipse
        cx={svgn(ellipse.cx)}
        cy={svgn(ellipse.cy)}
        rx={svgn(ellipse.rx)}
        ry={svgn(ellipse.ry)}
        fill="none"
        stroke={colorToCSS(color.get())}
        strokeWidth={svgn(strokeWidth)}
        strokeMiterlimit="10"
        mask="url(#ellipseMask)"
        ref={ellipseRef}
      />
      <mask id="pathMask">
        <rect fill="white" width="100%" height="100%" />
        <ellipse
          cx={svgn(ellipse.cx)}
          cy={svgn(ellipse.cy)}
          rx={svgn(ellipse.rx - strokeWidth / 2)}
          ry={svgn(ellipse.ry - strokeWidth / 2)}
          fill="black"
          stroke="transparent"
          strokeWidth={svgn(strokeWidth)}
          strokeMiterlimit="10"
        />
      </mask>
      <path
        d={pathData}
        fill="none"
        stroke={colorToCSS(color.get())}
        strokeWidth={svgn(strokeWidth)}
        strokeMiterlimit="10"
        strokeLinejoin="round"
        mask="url(#pathMask)"
        ref={pathRef}
      />
    </>
  );
};
