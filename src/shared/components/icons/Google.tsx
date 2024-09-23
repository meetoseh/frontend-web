import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Google icon / google logo */
export const Google = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({
    ...props,
    natural: { width: 18, height: 19 },
  });
  return (
    <svg width={c.width} height={c.height} viewBox={c.viewBox} fill="none">
      <g clipPath="url(#a)">
        <path
          fill={c.color}
          fillRule="evenodd"
          d="M13.08 6.502a4.483 4.483 0 0 0-3.165-1.237c-2.152 0-3.98 1.452-4.632 3.407a4.941 4.941 0 0 0 0 3.159h.003c.655 1.952 2.48 3.404 4.632 3.404 1.111 0 2.065-.284 2.804-.786v-.002a3.818 3.818 0 0 0 1.65-2.507H9.914V8.763h7.782c.097.552.142 1.116.142 1.676 0 2.51-.897 4.631-2.457 6.068l.002.001C14.017 17.77 12.14 18.5 9.915 18.5a8.251 8.251 0 0 1-7.372-4.544 8.257 8.257 0 0 1 0-7.409A8.248 8.248 0 0 1 9.915 2a7.929 7.929 0 0 1 5.52 2.146L13.08 6.502Z"
          clipRule="evenodd"
        />
      </g>
      <defs>
        <clipPath id="a">
          <path fill={c.color} d="M1.5 2H18v16.5H1.5z" />
        </clipPath>
      </defs>
    </svg>
  );
}, areResizableSvgPropsEqual);
