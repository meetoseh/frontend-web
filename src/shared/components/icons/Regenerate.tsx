import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Regenerate icon / circular arrow */
export const Regenerate = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 18, height: 18 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.00014 1C10.8873 1.00003 12.7137 1.6672 14.1565 2.8836C15.5994 4.09999 16.5657 5.78729 16.8848 7.64728C17.2039 9.50727 16.8552 11.4202 15.9003 13.0479C14.9454 14.6757 13.4459 15.9135 11.6666 16.5425C9.88738 17.1715 7.94305 17.1513 6.17727 16.4855C4.41149 15.8196 2.93795 14.5509 2.01709 12.9037C1.09623 11.2564 0.787342 9.3367 1.14502 7.48374C1.5027 5.63079 2.50391 3.96393 3.9717 2.77778M1 2.33333H4.55556V5.88889"
        stroke={c.color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
