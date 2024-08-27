import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Play icon / triangle, left side flat */
export const Play = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 20, height: 20 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.61449 15C6.4119 15 6.2261 14.95 6.05725 14.8666C5.71954 14.6667 5.5 14.3166 5.5 13.9L5.50005 6.11667C5.50005 5.73331 5.71959 5.33337 6.0573 5.14998C6.39501 4.95001 6.85089 4.95001 7.18859 5.14998L13.9428 9.03329C14.2805 9.23326 14.5 9.58331 14.5 9.99998C14.5 10.4166 14.2805 10.75 13.9428 10.9667L7.18859 14.85C7.00287 14.9499 6.81709 14.9999 6.61448 14.9999L6.61449 15Z"
        stroke="none"
        fill={c.color}
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
