import { ReactElement } from 'react';
import { TextInterstitialParamsMapped } from './TextInterstitialParams';
import { TextInterstitialResources } from './TextInterstitialResources';
import { ScreenComponentProps } from '../../models/Screen';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { OsehStyles } from '../../../../shared/OsehStyles';
import { ScreenTextContent } from '../../components/ScreenTextContent';
import { Button } from '../../../../shared/forms/Button';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { ScreenConfigurableTrigger } from '../../models/ScreenConfigurableTrigger';

/**
 * A basic text interstitial screen with a optional top message, some main content,
 * and then some ctas at the bottom
 */
export const TextInterstitial = ({
  ctx,
  screen,
  startPop,
  trace,
}: ScreenComponentProps<
  'text_interstitial',
  TextInterstitialResources,
  TextInterstitialParamsMapped
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const makeOnClick =
    (
      btn: { exit: StandardScreenTransition; trigger: ScreenConfigurableTrigger },
      label: string
    ): React.MouseEventHandler<HTMLButtonElement> =>
    (e) => {
      e.preventDefault();
      configurableScreenOut(workingVWC, startPop, transition, btn.exit, btn.trigger, {
        beforeDone: async () => {
          trace({ type: 'cta', label });
        },
      });
    };

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={32} />
        {screen.parameters.top !== null && (
          <div
            className={combineClasses(
              OsehStyles.typography.body,
              OsehStyles.colors.v4.primary.light
            )}>
            {screen.parameters.top}
          </div>
        )}
        <VerticalSpacer height={32} flexGrow={1} />
        <ScreenTextContent content={screen.parameters.content} />
        <VerticalSpacer height={32} flexGrow={1} />
        {screen.parameters.primaryButton !== null && (
          <Button
            type="button"
            variant="filled-white"
            fullWidth
            onClick={makeOnClick(screen.parameters.primaryButton, 'primary')}>
            {screen.parameters.primaryButton.text}
          </Button>
        )}
        {screen.parameters.primaryButton !== null && screen.parameters.secondaryButton !== null && (
          <VerticalSpacer height={16} />
        )}
        {screen.parameters.secondaryButton !== null && (
          <Button
            type="button"
            variant="outlined-white"
            fullWidth
            onClick={makeOnClick(screen.parameters.secondaryButton, 'secondary')}>
            {screen.parameters.secondaryButton.text}
          </Button>
        )}
        {(screen.parameters.primaryButton !== null || screen.parameters.secondaryButton !== null) &&
          screen.parameters.tertiaryButton !== null && <VerticalSpacer height={16} />}
        {screen.parameters.tertiaryButton !== null && (
          <Button
            type="button"
            variant="link-white"
            fullWidth
            onClick={makeOnClick(screen.parameters.tertiaryButton, 'tertiary')}>
            {screen.parameters.tertiaryButton.text}
          </Button>
        )}
        <VerticalSpacer height={32} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
