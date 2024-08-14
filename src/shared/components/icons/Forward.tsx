import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Forward icon / right caret */
export const Forward = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 20, height: 20 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M6.75 3.5L13.25 10L6.75 16.5" stroke={c.color} strokeWidth="2" />
    </svg>
  );
}, areResizableSvgPropsEqual);
