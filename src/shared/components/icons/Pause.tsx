import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Pause icon / two tall rectangles laid out horizontally */
export const Pause = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 16, height: 26 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 0.5C4.38071 0.5 5.5 1.61929 5.5 3V23C5.5 24.3807 4.38071 25.5 3 25.5C1.61929 25.5 0.5 24.3807 0.5 23V3C0.5 1.61929 1.61929 0.5 3 0.5ZM13 0.5C14.3807 0.5 15.5 1.61929 15.5 3L15.5 23C15.5 24.3807 14.3807 25.5 13 25.5C11.6193 25.5 10.5 24.3807 10.5 23L10.5 3C10.5 1.61929 11.6193 0.5 13 0.5Z"
        fill={c.color}
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
