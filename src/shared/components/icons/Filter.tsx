import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Filter icon / three vertically stacked lines with reducing widths */
export const Filter = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 16, height: 16 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.5 3.75H15.5V5.25H0.5V3.75ZM3 7.25H13V8.75H3V7.25ZM6 10.75H10V12.25H6V10.75Z"
        fill={c.color}
        stroke="none"
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
