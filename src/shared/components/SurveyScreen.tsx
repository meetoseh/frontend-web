import { CSSProperties, PropsWithChildren, ReactElement } from 'react';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import styles from './SurveyScreen.module.css';
import { FullHeightDiv } from './FullHeightDiv';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { BackContinue } from './BackContinue';
import { useInitializedTransitionProp } from '../lib/TransitionProp';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useWindowSizeValueWithCallbacks } from '../hooks/useWindowSize';
import { setVWC } from '../lib/setVWC';
import { convertLogicalWidthToPhysicalWidth } from '../images/DisplayRatioHelper';
import { useStyleVWC } from '../hooks/useStyleVWC';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import {
  StandardScreenTransitionProp,
  useStandardTransitionsState,
} from '../hooks/useStandardTransitions';

export type SurveyScreenProps = {
  /** The title, usually the question */
  title: VariableStrategyProps<ReactElement>;
  /** The subtitle, usually the purpose for the question */
  subtitle: VariableStrategyProps<ReactElement>;
  /** The handler for when the back button is pressed, or null for no back button */
  onBack: VariableStrategyProps<(() => void) | null>;
  /** The handler for when the continue button is pressed */
  onContinue: VariableStrategyProps<() => void>;
  /** If specified, can be used to setup and trigger entrance/exit animations */
  transition?: StandardScreenTransitionProp;
};

/**
 * Presents a basic dark screen with a title, subtitle, children, and a back/continue footer.
 */
export const SurveyScreen = ({
  title: titleVSP,
  subtitle: subtitleVSP,
  onBack: onBackVSP,
  onContinue: onContinueVSP,
  transition: transitionRaw,
  children,
}: PropsWithChildren<SurveyScreenProps>) => {
  const titleVWC = useVariableStrategyPropsAsValueWithCallbacks(titleVSP);
  const subtitleVWC = useVariableStrategyPropsAsValueWithCallbacks(subtitleVSP);
  const onBackVWC = useVariableStrategyPropsAsValueWithCallbacks(onBackVSP);
  const onContinueVWC = useVariableStrategyPropsAsValueWithCallbacks(onContinueVSP);
  const transition = useInitializedTransitionProp(transitionRaw, () => ({ type: 'none', ms: 0 }));

  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const transitionState = useStandardTransitionsState(transition);

  const containerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const containerStyleVWC = useMappedValueWithCallbacks(windowSizeVWC, (windowSize) => ({
    width: windowSize.width,
    overflow: 'hidden',
  }));
  useStyleVWC(containerRef, containerStyleVWC);

  const foregroundRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const foregroundStyleVWC = useMappedValuesWithCallbacks(
    [transitionState.left, transitionState.opacity],
    (): CSSProperties => {
      const left = transitionState.left.get();
      const opacity = transitionState.opacity.get();
      const leftIsZero = convertLogicalWidthToPhysicalWidth(Math.abs(left)) < 1;
      const opacityIsOne = opacity > 0.999;
      return {
        position: leftIsZero ? 'static' : 'relative',
        left: leftIsZero ? 'unset' : `${left}px`,
        opacity: opacityIsOne ? '1' : `${opacity}`,
      };
    }
  );
  useStyleVWC(foregroundRef, foregroundStyleVWC);

  return (
    <div
      className={styles.container}
      style={containerStyleVWC.get()}
      ref={(r) => setVWC(containerRef, r)}>
      <FullHeightDiv className={styles.background} />
      <div
        className={styles.foreground}
        style={foregroundStyleVWC.get()}
        ref={(r) => setVWC(foregroundRef, r)}>
        <div className={styles.foregroundInner}>
          <div className={styles.content}>
            <div className={styles.title}>
              <RenderGuardedComponent props={titleVWC} component={(title) => title} />
            </div>
            <div className={styles.subtitle}>
              <RenderGuardedComponent props={subtitleVWC} component={(subtitle) => subtitle} />
            </div>

            {children}
          </div>
          <div className={styles.footer}>
            <RenderGuardedComponent
              props={onBackVWC}
              component={(onBack) => (
                <BackContinue onBack={onBack} onContinue={() => onContinueVWC.get()()} />
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
