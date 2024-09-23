import { memo } from 'react';
import {
  areResizableSvgPropsEqual,
  computeResizableSvgProps,
  ResizableSvgProps,
} from '../../models/ResizableSvgProps';

/** Anonymous icon / hat and eyes */
export const Anonymous = memo((props: ResizableSvgProps) => {
  const c = computeResizableSvgProps({
    ...props,
    natural: { width: 512, height: 512 },
  });
  return (
    <svg width={c.width} height={c.height} viewBox={c.viewBox} fill="none">
      <path
        fill={c.color}
        d="M497.612,134.031c0,0-30.453,30.438-96.391,30.438c-49.922,0-107.156,5.016-145.234,55.906
		c-38.078-50.891-95.313-55.906-145.219-55.906c-65.953,0-96.391-30.438-96.391-30.438s-39.625,83.703,12.688,170.281
		c41.078,67.953,121.75,83.688,175.016,68.156c26.359-7.688,47.672-27.375,53.906-33.563c6.234,6.188,27.563,25.875,53.922,33.563
		c53.266,15.531,133.938-0.203,175.032-68.156C537.253,217.734,497.612,134.031,497.612,134.031z M142.221,292.063
		c-30.313-6.75-48.5-30.688-45.594-46.234c2.328-12.375,48.844-15.234,69.031-7.609c20.219,7.625,36.391,18.125,36.563,30.016
		C202.393,280.109,172.549,298.813,142.221,292.063z M369.752,292.063c-30.313,6.75-60.156-11.953-60-23.828
		c0.172-11.891,16.375-22.391,36.563-30.016s66.703-4.766,69.047,7.609C418.268,261.375,400.081,285.313,369.752,292.063z"
      />
    </svg>
  );
}, areResizableSvgPropsEqual);
