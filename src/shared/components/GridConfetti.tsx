import { ReactElement } from 'react';
import styles from './GridConfetti.module.css';
import { ValueWithCallbacks } from '../lib/Callbacks';
import { Confetti } from './confetti/Confetti';
import { RenderGuardedComponent } from './RenderGuardedComponent';

/**
 * An element which fills the background using grid-area: 1 / 1 / -1 / -1
 * and adds confetti
 */
export const GridConfetti = ({
  windowSizeImmediate,
}: {
  windowSizeImmediate: ValueWithCallbacks<{ width: number; height: number }>;
}): ReactElement => {
  return (
    <RenderGuardedComponent
      props={windowSizeImmediate}
      component={(size) => (
        <div
          className={styles.container}
          style={{ width: `${size.width}px`, height: `${size.height}px` }}>
          <Confetti
            wind={{
              x: -5,
              y: 45,
            }}
            box={{
              left: 0,
              top: 0,
              width: size.width,
              height: size.height,
            }}
            capacity={200}
            position={{
              x: {
                min: size.width * 0.3,
                max: size.width * 0.6,
              },
              y: {
                min: size.height * 0.9,
                max: size.height,
              },
            }}
            velocity={{
              x: {
                min: -100,
                max: 100,
              },
              y: {
                min: -250,
                max: -100,
              },
            }}
            acceleration={{
              x: {
                min: -0.3,
                max: 0.3,
              },
              y: {
                min: 0.1,
                max: -0.1,
              },
            }}
            rotation={{
              x: {
                min: -Math.PI,
                max: Math.PI,
              },
              y: {
                min: -Math.PI,
                max: Math.PI,
              },
              z: {
                min: -Math.PI,
                max: Math.PI,
              },
            }}
            rotationVelocity={{
              x: {
                min: -10,
                max: 10,
              },
              y: {
                min: -10,
                max: 10,
              },
              z: {
                min: -10,
                max: 10,
              },
            }}
            spawnChance={200}
            spawnChanceVelocity={-100}
          />
        </div>
      )}
    />
  );
};
