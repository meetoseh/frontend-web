import { ReactElement, useContext } from 'react';
import { ScreenContext } from '../core/hooks/useScreenContext';
import styles from './AnonymousAccountCreation.module.css';
import { GridFullscreenContainer } from '../../shared/components/GridFullscreenContainer';
import { GridBlackBackground } from '../../shared/components/GridBlackBackground';
import { GridContentContainer } from '../../shared/components/GridContentContainer';
import { VerticalSpacer } from '../../shared/components/VerticalSpacer';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../shared/lib/setVWC';
import { createValueWithCallbacksEffect } from '../../shared/hooks/createValueWithCallbacksEffect';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';

/**
 * The special splash screen we use when generating an account using
 * silent auth, which uses rsa 4096 and may take a while.
 */
export const AnonymousAccountCreation = ({ ctx }: { ctx: ScreenContext }): ReactElement => {
  const progress = useWritableValueWithCallbacks<string[]>(() => []);

  useValueWithCallbacksEffect(ctx.login.value, (v) => {
    if (v.state !== 'loading' || v.hint !== 'silent-auth') {
      setVWC(progress, []);
      return undefined;
    }

    return createValueWithCallbacksEffect(v.progress, (p) => {
      setVWC(progress, p);
      return undefined;
    });
  });

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridBlackBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.text}>Setting up a secure environment</div>
        <VerticalSpacer height={16} />
        <div className={styles.subtext}>
          This usually only takes a few seconds, and allows you to try out the app without needing
          to create an account.
        </div>
        <RenderGuardedComponent
          props={progress}
          component={(p) => {
            const parts: ReactElement[] = [];
            for (let i = 0; i < p.length; i++) {
              parts.push(<VerticalSpacer key={parts.length} height={i === 0 ? 24 : 8} />);
              parts.push(
                <div className={styles.progress} key={parts.length}>
                  {p[i]}
                </div>
              );
            }
            return <>{parts}</>;
          }}
        />
        <VerticalSpacer height={0} flexGrow={1} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
