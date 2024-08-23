import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** HeartFilled icon / filled heart */
export const HeartFilled = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({ ...props, natural: { width: 20, height: 20 } });
  return (
    <svg
      width={c.width}
      height={c.height}
      viewBox={c.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.49271 4.05679C7.11198 3.95632 7.74703 3.98946 8.35105 4.15378C8.95508 4.31809 9.51268 4.60938 9.98275 5.00619L10.0086 5.02817L10.0324 5.00818C10.4811 4.63329 11.0085 4.3538 11.5796 4.18836C12.1506 4.02293 12.7521 3.97535 13.344 4.0488L13.5162 4.07278C14.2622 4.19544 14.9596 4.50794 15.5344 4.97718C16.1092 5.44643 16.54 6.05495 16.7812 6.7383C17.0224 7.42166 17.0651 8.15441 16.9047 8.85897C16.7442 9.56353 16.3867 10.2137 15.8699 10.7405L15.744 10.8638L15.7104 10.8911L10.4977 15.8073C10.3774 15.9207 10.2181 15.9887 10.0491 15.9987C9.88022 16.0087 9.7132 15.9602 9.57903 15.8619L9.51326 15.8073L4.27051 10.8624C3.71511 10.3479 3.32012 9.69698 3.12929 8.98182C2.93846 8.26667 2.95922 7.51518 3.18929 6.81058C3.41936 6.10597 3.84976 5.47575 4.43281 4.98971C5.01586 4.50367 5.72881 4.18078 6.49271 4.05679Z"
        fill={c.color}
        stroke="none"
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
