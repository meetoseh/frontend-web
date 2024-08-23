import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Check icon / check */
export const Check = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 20, height: 20 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.34314 10.8856L8.11438 14.6569L15.6568 7.11438"
        stroke={c.color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
