import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Close icon / x */
export const Close = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 20, height: 20 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16.125 4.64294L14.8913 3.29169L10 8.64877L5.10875 3.29169L3.875 4.64294L8.76625 10L3.875 15.3571L5.10875 16.7084L10 11.3513L14.8913 16.7084L16.125 15.3571L11.2337 10L16.125 4.64294Z"
        fill={c.color}
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
