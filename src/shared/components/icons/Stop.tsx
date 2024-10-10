import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Stop icon / square in circle / suggested color: light, color2: dark */
export const Stop = memo(
  ({ color2, ...props }: ResizableSvgProps & { color2: string }) => {
    const c = computeResizableSvgProps({ ...props, natural: { width: 30, height: 30 } });
    return (
      <svg
        width={c.width}
        height={c.height}
        viewBox={c.viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="15" fill={c.color} />
        <rect x="9.375" y="9.375" width="11.25" height="11.25" rx="1.875" fill={color2} />
      </svg>
    );
  },
  (a, b) => areResizableSvgPropsEqual(a, b) && a.color2 === b.color2
);
