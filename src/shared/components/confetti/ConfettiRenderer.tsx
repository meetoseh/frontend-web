import { ReactElement, useEffect } from 'react';
import { useWritableValueWithCallbacks } from '../../lib/Callbacks';
import { ConfettiPhysics } from './ConfettiPhysics';
import styles from './ConfettiRenderer.module.css';
import { setVWC } from '../../lib/setVWC';
import { RenderGuardedComponent } from '../RenderGuardedComponent';

/**
 * Renders the confetti within the given physics engine
 */
export const ConfettiRenderer = ({ physics }: { physics: ConfettiPhysics }): ReactElement => {
  const elements = useWritableValueWithCallbacks<ReactElement[]>(() => []);
  useEffect(() => {
    const cap = physics.capacity;
    const refs: (HTMLDivElement | null)[] = Array(cap).fill(null);
    const newElements = Array.from({ length: cap }, (_, i) => {
      return (
        <div
          className={styles.confetti}
          key={i}
          ref={(r) => {
            refs[i] = r;
          }}
        />
      );
    });
    onTick();
    setVWC(elements, newElements);
    physics.callbacks.add(onTick);
    return () => {
      physics.callbacks.remove(onTick);
    };

    function onTick() {
      for (let i = 0; i < cap; i++) {
        const ref = refs[i];
        if (ref === null) {
          continue;
        }

        if (physics.widths[i] === 0) {
          ref.style.display = 'none';
          continue;
        }

        ref.style.display = 'block';
        ref.style.width = `${physics.widths[i]}px`;
        ref.style.height = `${physics.heights[i]}px`;
        ref.style.borderRadius = `${physics.borderRadii[i]}px`;
        ref.style.backgroundColor = physics.colors[i];
        ref.style.left = `${physics.xs[i] - physics.box.left}px`;
        ref.style.top = `${physics.ys[i] - physics.box.top}px`;
        ref.style.transform = `rotateX(${physics.rotationXs[i]}rad) rotateY(${physics.rotationYs[i]}rad) rotateZ(${physics.rotationZs[i]}rad)`;
      }
    }
  }, [physics, elements]);

  return (
    <RenderGuardedComponent
      props={elements}
      component={(e) => (
        <div
          className={styles.container}
          style={{
            left: physics.box.left,
            top: physics.box.top,
            width: physics.box.width,
            height: physics.box.height,
          }}>
          {e}
        </div>
      )}
    />
  );
};
