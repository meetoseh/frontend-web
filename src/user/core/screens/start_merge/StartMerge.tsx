import { ReactElement, useEffect, useMemo } from 'react';
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
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { StartMergeResources } from './StartMergeResources';
import { StartMergeMappedParams } from './StartMergeParams';
import {
  LOGIN_NAMES_BY_PROVIDER,
  ProvidersList,
  ProvidersListItem,
} from '../../../login/components/ProvidersList';
import { screenWithWorking } from '../../lib/screenWithWorking';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { OauthProvider } from '../../../login/lib/OauthProvider';
import { handlePasskeyAuthenticateForMerge } from '../../lib/passkeyHelpers';

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
  const cleanedProviders = useMemo(() => {
    const result: { provider: OauthProvider; url: string }[] = [];
    for (const provider of screen.parameters.providers) {
      if (provider.provider in LOGIN_NAMES_BY_PROVIDER && provider.provider !== 'Silent') {
        result.push(provider);
      }
    }
    return result;
  }, [screen.parameters.providers]);

  useEffect(() => {
    if (cleanedProviders.length === 0) {
      screenWithWorking(workingVWC, async () => {
        trace({ type: 'skip', reason: 'no providers in list' });
        const trigger = screen.parameters.skip.trigger;
        startPop(
          trigger.type === 'pop' ? null : { slug: trigger.flow, parameters: trigger.parameters },
          trigger.endpoint ?? undefined
        )();
      });
    }
  }, [cleanedProviders, startPop, trace, workingVWC, screen.parameters.skip.trigger]);

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
          items={cleanedProviders.map(
            ({ provider, url }): ProvidersListItem => ({
              provider,
              onClick:
                provider === 'Passkey'
                  ? async () => {
                      trace({ type: 'provider', provider });
                      const loginContext = ctx.login.value.get();
                      if (loginContext.state !== 'logged-in') {
                        return;
                      }
                      const token = await handlePasskeyAuthenticateForMerge(loginContext);
                      window.location.assign('/#merge_token=' + token.mergeToken);
                      window.location.reload();
                    }
                  : url,
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
            configurableScreenOut(
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
