import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Apple icon / apple logo */
export const Apple = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({
    ...props,
    natural: { width: 18, height: 19 },
  });
  return (
    <svg width={c.width} height={c.height} viewBox={c.viewBox} fill="none">
      <g clipPath="url(#a)">
        <path
          fill={c.color}
          d="M16.344 14.528a9.786 9.786 0 0 1-.968 1.74c-.509.725-.925 1.227-1.246 1.506-.498.458-1.032.692-1.603.706-.41 0-.904-.117-1.48-.354-.577-.235-1.108-.352-1.593-.352-.509 0-1.054.117-1.638.352-.585.237-1.056.36-1.416.373-.548.023-1.093-.218-1.638-.725-.348-.303-.783-.823-1.304-1.56-.56-.786-1.019-1.698-1.379-2.738-.386-1.124-.579-2.212-.579-3.265 0-1.206.26-2.246.783-3.118.41-.7.956-1.253 1.64-1.658a4.41 4.41 0 0 1 2.216-.626c.434 0 1.005.135 1.714.4.707.264 1.16.399 1.36.399.148 0 .653-.157 1.507-.471.809-.29 1.49-.411 2.05-.364 1.514.122 2.652.72 3.408 1.795-1.354.82-2.024 1.97-2.01 3.444.012 1.149.428 2.105 1.247 2.864.371.352.786.624 1.247.817-.1.29-.206.568-.318.835ZM12.871.86c0 .9-.33 1.741-.985 2.519-.79.925-1.748 1.46-2.785 1.375a2.8 2.8 0 0 1-.021-.341c0-.864.376-1.79 1.044-2.545a4.02 4.02 0 0 1 1.272-.956c.514-.25 1-.388 1.456-.412.013.12.019.24.019.36Z"
        />
      </g>
      <defs>
        <clipPath id="a">
          <path fill={c.color} d="M0 .5h18v18H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}, areResizableSvgPropsEqual);
