import { ReactElement, useEffect } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './StartMerge.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { screenOut } from '../../lib/screenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { StartMergeResources } from './StartMergeResources';
import { StartMergeMappedParams } from './StartMergeParams';
import { ProvidersList, ProvidersListItem } from '../../features/login/components/ProvidersList';
import { screenWithWorking } from '../../lib/screenWithWorking';

/**
 * Allows the user to merge their account using one of the indicated providers.
 */
export const StartMerge = ({
  ctx,
  screen,
  trace,
  startPop,
}: ScreenComponentProps<
  'start_merge',
  StartMergeResources,
  StartMergeMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  useEffect(() => {
    if (screen.parameters.providers.length === 0) {
      screenWithWorking(workingVWC, async () => {
        trace({ type: 'skip', reason: 'no providers in list' });
        startPop(
          screen.parameters.skip.trigger === null
            ? null
            : {
                slug: screen.parameters.skip.trigger,
                parameters: {},
              }
        )();
      });
    }
  }, [screen.parameters.providers, startPop, trace, workingVWC, screen.parameters.skip.trigger]);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.header}>{screen.parameters.header}</div>
        {screen.parameters.message !== null && (
          <>
            <VerticalSpacer height={16} />
            <div className={styles.message}>{screen.parameters.message}</div>
          </>
        )}
        <VerticalSpacer height={24} />
        <ProvidersList
          items={screen.parameters.providers.map(
            ({ provider, url }): ProvidersListItem => ({
              provider,
              onClick: url,
              onLinkClick: () => {
                trace({ type: 'provider', provider });
              },
            })
          )}
        />
        <VerticalSpacer height={0} flexGrow={1} />
        <Button
          type="button"
          variant="outlined-white"
          onClick={(e) => {
            e.preventDefault();
            screenOut(
              workingVWC,
              startPop,
              transition,
              screen.parameters.skip.exit,
              screen.parameters.skip.trigger,
              {
                beforeDone: async () => {
                  trace({ type: 'skip' });
                },
              }
            );
          }}>
          {screen.parameters.skip.text}
        </Button>
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
