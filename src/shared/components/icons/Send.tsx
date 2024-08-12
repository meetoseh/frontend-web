import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Send icon / arrow in circle / suggested color: light, color2: dark */
export const Send = memo(
  ({ color2, ...props }: ResizableSvgProps & { color2: string }) => {
    const c = computeResizableSvgProps({ ...props, natural: { width: 24, height: 24 } });
    return (
      <svg
        width={c.width}
        height={c.height}
        viewBox={c.viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill={c.color} />
        <path
          d="M17.7044 11.2875L12.7086 6.28745C12.6135 6.19641 12.5015 6.12505 12.3788 6.07745C12.1356 5.97744 11.8627 5.97744 11.6195 6.07745C11.4968 6.12505 11.3848 6.19641 11.2897 6.28745L6.29385 11.2875C6.20069 11.3807 6.12679 11.4914 6.07637 11.6132C6.02595 11.735 6 11.8656 6 11.9975C6 12.2638 6.1057 12.5192 6.29385 12.7075C6.482 12.8958 6.73718 13.0015 7.00326 13.0015C7.26935 13.0015 7.52453 12.8958 7.71268 12.7075L11 9.40745L11 16.9975C11 17.2627 11.1052 17.517 11.2926 17.7046C11.48 17.8921 11.7341 17.9975 11.9991 17.9975C12.2641 17.9975 12.5183 17.8921 12.7057 17.7046C12.8931 17.517 12.9983 17.2627 12.9983 16.9975L12.9983 9.40745L16.2856 12.7075C16.3785 12.8012 16.489 12.8756 16.6108 12.9263C16.7325 12.9771 16.8631 13.0033 16.995 13.0033C17.1269 13.0033 17.2575 12.9771 17.3793 12.9263C17.501 12.8756 17.6116 12.8012 17.7044 12.7075C17.7981 12.6145 17.8724 12.5039 17.9232 12.382C17.9739 12.2602 18 12.1295 18 11.9975C18 11.8654 17.9739 11.7347 17.9232 11.6129C17.8724 11.491 17.7981 11.3804 17.7044 11.2875Z"
          fill={color2}
        />
      </svg>
    );
  },
  (a, b) => areResizableSvgPropsEqual(a, b) && a.color2 === b.color2
);
