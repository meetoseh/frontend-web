import { ReactElement, useEffect } from 'react';
import { useWritableValueWithCallbacks } from '../../lib/Callbacks';
import { RenderGuardedComponent } from '../RenderGuardedComponent';
import { ConfettiPhysics } from './ConfettiPhysics';
import { ConfettiRenderer } from './ConfettiRenderer';
import { CancelablePromise } from '../../lib/CancelablePromise';
import { setVWC } from '../../lib/setVWC';

/**
 * Convenience component which creates confetti physics, turns on auto ticking
 * and auto spawning, then renders the confetti. Cleans itself up 10 seconds
 * after spawning ends.
 *
 * Remounting this component will reset the confetti.
 */
export const Confetti = ({
  wind,
  box,
  capacity,
  ...spawnInfo
}: {
  wind: { x: number; y: number };
  box: { left: number; top: number; width: number; height: number };
  capacity: number;
  position: { x: { min: number; max: number }; y: { min: number; max: number } };
  velocity: { x: { min: number; max: number }; y: { min: number; max: number } };
  acceleration: { x: { min: number; max: number }; y: { min: number; max: number } };
  rotation: {
    x: { min: number; max: number };
    y: { min: number; max: number };
    z: { min: number; max: number };
  };
  rotationVelocity: {
    x: { min: number; max: number };
    y: { min: number; max: number };
    z: { min: number; max: number };
  };
  spawnChance: number;
  spawnChanceVelocity: number;
}): ReactElement => {
  const physicsVWC = useWritableValueWithCallbacks<ConfettiPhysics | null>(() => null);

  useEffect(() => {
    const physics = new ConfettiPhysics(wind, box, capacity);
    let spawningPromise: CancelablePromise<void> | null = physics.autoSpawn(spawnInfo);
    let cancelTicking: (() => void) | null = physics.autoTick();
    let timeout: NodeJS.Timeout | null = null;
    let active = true;

    const cancel = () => {
      active = false;
      cancelTicking?.();
      spawningPromise?.cancel();

      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }

      cancelTicking = null;
      spawningPromise = null;

      if (Object.is(physicsVWC.get(), physics)) {
        setVWC(physicsVWC, null);
      }
    };

    const onPromiseDone = () => {
      if (!active) {
        return;
      }

      timeout = setTimeout(() => {
        cancel();
      }, 10000);
    };

    // `promise.finally` doesn't silence exceptions, so we use then with 2 args instead
    spawningPromise.promise.then(onPromiseDone, (e) => {
      if (active) {
        console.error('Confetti spawning failed:', e);
      }
      onPromiseDone();
    });

    setVWC(physicsVWC, physics);
    return cancel;
  });

  return (
    <RenderGuardedComponent
      props={physicsVWC}
      component={(physics) => (physics === null ? <></> : <ConfettiRenderer physics={physics} />)}
    />
  );
};
