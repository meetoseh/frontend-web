import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** SendRight icon / arrow pointing right in circle / suggested color: light, color2: dark */
export const SendRight = memo(
  ({ color2, ...props }: ResizableSvgProps & { color2: string }) => {
    const c = computeResizableSvgProps({ ...props, natural: { width: 24, height: 24 } });
    return (
      <svg
        width={c.width}
        height={c.height}
        viewBox={c.viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill={c.color} />
        <path
          d="M 12.712 17.703 L 17.712 12.708 C 17.803 12.613 17.874 12.501 17.922 12.378 C 18.022 12.135 18.022 11.862 17.922 11.619 C 17.874 11.496 17.803 11.384 17.712 11.289 L 12.712 6.293 C 12.618 6.2 12.508 6.126 12.386 6.075 C 12.264 6.025 12.133 5.999 12.002 5.999 C 11.735 5.999 11.48 6.105 11.292 6.293 C 11.103 6.481 10.998 6.736 10.998 7.002 C 10.998 7.268 11.103 7.524 11.292 7.712 L 14.592 10.999 L 7.002 10.999 C 6.736 10.999 6.482 11.104 6.294 11.292 C 6.107 11.479 6.002 11.733 6.002 11.998 C 6.002 12.263 6.107 12.517 6.294 12.705 C 6.482 12.892 6.736 12.997 7.002 12.997 L 14.592 12.997 L 11.292 16.285 C 11.198 16.377 11.123 16.488 11.073 16.61 C 11.022 16.732 10.996 16.862 10.996 16.994 C 10.996 17.126 11.022 17.257 11.073 17.378 C 11.123 17.5 11.198 17.611 11.292 17.703 C 11.385 17.797 11.495 17.871 11.617 17.922 C 11.739 17.973 11.87 17.999 12.002 17.999 C 12.134 17.999 12.264 17.973 12.386 17.922 C 12.508 17.871 12.619 17.797 12.712 17.703 Z"
          fill={color2}
        />
      </svg>
    );
  },
  (a, b) => areResizableSvgPropsEqual(a, b) && a.color2 === b.color2
);
