import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Edit icon / pencil on square */
export const Edit = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 18, height: 18 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14.8141 0.5L17.5 3.18591L15.4524 5.23436L12.7665 2.54845L14.8141 0.5ZM4.97651 13.0235H7.66242L14.1865 6.49942L11.5006 3.81351L4.97651 10.3376V13.0235Z"
        fill={c.color}
      />
      <path
        d="M14.8248 15.7094H5.11797C5.09469 15.7094 5.07052 15.7184 5.04724 15.7184C5.0177 15.7184 4.98815 15.7103 4.95771 15.7094H2.2906V3.17516H8.42074L10.2113 1.38456H2.2906C1.30309 1.38456 0.5 2.18675 0.5 3.17516V15.7094C0.5 16.6978 1.30309 17.5 2.2906 17.5H14.8248C15.2997 17.5 15.7552 17.3113 16.091 16.9755C16.4268 16.6397 16.6154 16.1843 16.6154 15.7094V7.94892L14.8248 9.73952V15.7094Z"
        fill={c.color}
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
