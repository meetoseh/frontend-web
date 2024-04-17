import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { useStyleVWC } from '../hooks/useStyleVWC';
import styles from './OpacityTransitionOverlay.module.css';
import { setVWC } from '../lib/setVWC';
import { StandardScreenTransitionState } from '../hooks/useStandardTransitions';
import { CSSProperties } from 'react';

export type OpacityTransitionOverlayProps = Pick<StandardScreenTransitionState, 'opacity'>;

/**
 * Manages a standard opacity transition (see useStandardTransitions) via an
 * overlay on top of the screen that fades away (rather than the foreground
 * fading in, which can be quicker/nicer in some cases).
 *
 * This can also be used to transition a non-standard background to the standard
 * background by placing it between the background and foreground.
 *
 * This uses position absolute to cover the nearest relative parent.
 */
export const OpacityTransitionOverlay = ({ opacity }: OpacityTransitionOverlayProps) => {
  const neededVWC = useMappedValueWithCallbacks(opacity, (o) => o < 1 - 1e-3);
  const ref = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const styleVWC = useMappedValueWithCallbacks(
    opacity,
    (opacity): CSSProperties => ({ opacity: `${1 - opacity}` })
  );
  useStyleVWC(ref, styleVWC);

  return (
    <RenderGuardedComponent
      props={neededVWC}
      component={(needed) =>
        !needed ? (
          <></>
        ) : (
          <div className={styles.container} style={styleVWC.get()} ref={(r) => setVWC(ref, r)} />
        )
      }
    />
  );
};
