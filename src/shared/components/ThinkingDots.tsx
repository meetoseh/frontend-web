import { CSSProperties, ReactElement, useEffect } from 'react';
import styles from './ThinkingDots.module.css';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import { ease } from '../lib/Bezier';
import { setVWC } from '../lib/setVWC';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { useStyleVWC } from '../hooks/useStyleVWC';
import { HorizontalSpacer } from './HorizontalSpacer';

export const ThinkingDots = (): ReactElement => {
  return (
    <div className={styles.container}>
      <Dot offset={0} frequency={3000} />
      <HorizontalSpacer width={12} />
      <Dot offset={1000} frequency={3000} />
      <HorizontalSpacer width={12} />
      <Dot offset={2000} frequency={3000} />
    </div>
  );
};

const Dot = ({ offset, frequency }: { offset: number; frequency: number }) => {
  const opacityVWC = useWritableValueWithCallbacks<number>(() => 0);

  useEffect(() => {
    let active = true;
    let scheduled: number | null = null;
    tick();
    return () => {
      active = false;
      if (scheduled !== null) {
        cancelAnimationFrame(scheduled);
        scheduled = null;
      }
    };

    function tick() {
      scheduled = null;
      if (!active) {
        return;
      }

      const progressLinear = ((Date.now() + offset) % frequency) / frequency;

      if (progressLinear < 0.5) {
        setVWC(opacityVWC, ease.y_x(progressLinear * 2));
      } else {
        setVWC(opacityVWC, 1 - ease.y_x((progressLinear - 0.5) * 2));
      }

      scheduled = requestAnimationFrame(tick);
    }
  }, [frequency, offset, opacityVWC]);

  const styleVWC = useMappedValueWithCallbacks(
    opacityVWC,
    (opacity): CSSProperties => ({ opacity })
  );
  const eleVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useStyleVWC(eleVWC, styleVWC);

  return <div className={styles.dot} style={styleVWC.get()} ref={(r) => setVWC(eleVWC, r)} />;
};
