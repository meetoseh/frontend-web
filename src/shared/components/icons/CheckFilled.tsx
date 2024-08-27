import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** CheckFilled icon / transparent check on a circle */
export const CheckFilled = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 9, height: 9 } });
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
        d="M5 8.99951C5.59095 8.99951 6.17611 8.88312 6.72208 8.65697C7.26804 8.43082 7.76412 8.09936 8.18198 7.68149C8.59984 7.26363 8.93131 6.76755 9.15746 6.22159C9.3836 5.67562 9.5 5.09046 9.5 4.49951C9.5 3.90856 9.3836 3.3234 9.15746 2.77744C8.93131 2.23147 8.59984 1.73539 8.18198 1.31753C7.76412 0.899668 7.26804 0.5682 6.72208 0.342054C6.17611 0.115908 5.59095 -0.00048829 5 -0.000488281C3.80653 -0.000488263 2.66193 0.473617 1.81802 1.31753C0.974106 2.16144 0.5 3.30604 0.5 4.49951C0.5 5.69299 0.974106 6.83758 1.81802 7.68149C2.66193 8.52541 3.80653 8.99951 5 8.99951ZM4.884 6.31951L7.384 3.31951L6.616 2.67951L4.466 5.25901L3.3535 4.14601L2.6465 4.85301L4.1465 6.35301L4.5335 6.74001L4.884 6.31951Z"
        fill={c.color}
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
