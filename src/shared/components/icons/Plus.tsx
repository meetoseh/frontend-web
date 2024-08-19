import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Add icon / plus */
export const Plus = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 20, height: 20 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M14 10.5H10.5V14H9.5V10.5H6V9.5H9.5V6H10.5V9.5H14V10.5Z" fill={c.color} />
    </svg>
  );
}, areResizableSvgPropsEqual);
