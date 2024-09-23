import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Passkey icon / person with key */
export const Passkey = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({
    ...props,
    natural: { width: 20, height: 20 },
  });
  return (
    <svg width={c.width} height={c.height} viewBox={c.viewBox} fill="none">
      <path
        fillRule="evenodd"
        d="M17.5313 12.3506C17.1965 12.5896 17.0914 13.0914 17.3823 13.3823C17.7234 13.7234 17.7234 14.2766 17.3823 14.6177L17.2071 14.7929C16.8166 15.1834 16.8166 15.8166 17.2071 16.2071L17.2929 16.2929C17.6834 16.6834 17.6834 17.3166 17.2929 17.7071L16.3536 18.6464C16.1583 18.8417 15.8417 18.8417 15.6464 18.6464L14.2929 17.2929C14.1054 17.1054 14 16.851 14 16.5858V12.6632C12.8175 12.1015 12 10.8962 12 9.5C12 7.567 13.567 6 15.5 6C17.433 6 19 7.567 19 9.5C19 10.6756 18.4204 11.7159 17.5313 12.3506ZM15.5 8C16.0523 8 16.5 8.44772 16.5 9C16.5 9.55228 16.0523 10 15.5 10C14.9477 10 14.5 9.55228 14.5 9C14.5 8.44772 14.9477 8 15.5 8Z"
        fill={c.color}
      />
      <path
        d="M11.5 5.55556C11.5 7.51923 9.933 9.11111 8 9.11111C6.067 9.11111 4.5 7.51923 4.5 5.55556C4.5 3.59188 6.067 2 8 2C9.933 2 11.5 3.59188 11.5 5.55556Z"
        fill={c.color}
      />
      <path
        d="M3.625 18C2.17525 18 1 16.8061 1 15.3333C1 13.8606 2.3125 10.8889 8 10.8889C9.08076 10.8889 10.0035 10.9962 10.7894 11.1801C11.1221 12.1128 11.7239 12.9171 12.5 13.5V17.997C12.4586 17.999 12.4169 18 12.375 18H3.625Z"
        fill={c.color}
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
