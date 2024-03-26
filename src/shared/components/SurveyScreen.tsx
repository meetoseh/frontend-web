import { PropsWithChildren, ReactElement } from 'react';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import styles from './SurveyScreen.module.css';
import { FullHeightDiv } from './FullHeightDiv';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { BackContinue } from './BackContinue';

export type SurveyScreenProps = {
  /** The title, usually the question */
  title: VariableStrategyProps<ReactElement>;
  /** The subtitle, usually the purpose for the question */
  subtitle: VariableStrategyProps<ReactElement>;
  /** The handler for when the back button is pressed, or null for no back button */
  onBack: VariableStrategyProps<(() => void) | null>;
  /** The handler for when the continue button is pressed */
  onContinue: VariableStrategyProps<() => void>;
};

/**
 * Presents a basic dark screen with a title, subtitle, children, and a back/continue footer.
 */
export const SurveyScreen = ({
  title: titleVSP,
  subtitle: subtitleVSP,
  onBack: onBackVSP,
  onContinue: onContinueVSP,
  children,
}: PropsWithChildren<SurveyScreenProps>) => {
  const titleVWC = useVariableStrategyPropsAsValueWithCallbacks(titleVSP);
  const subtitleVWC = useVariableStrategyPropsAsValueWithCallbacks(subtitleVSP);
  const onBackVWC = useVariableStrategyPropsAsValueWithCallbacks(onBackVSP);
  const onContinueVWC = useVariableStrategyPropsAsValueWithCallbacks(onContinueVSP);

  return (
    <div className={styles.container}>
      <FullHeightDiv className={styles.background} />
      <div className={styles.foreground}>
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
