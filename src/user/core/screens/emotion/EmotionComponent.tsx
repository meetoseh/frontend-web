import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './EmotionComponent.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { EmotionResources } from './EmotionResources';
import { EmotionMappedParams } from './EmotionParams';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { IconButton } from '../../../../shared/forms/IconButton';
import { trackClassTaken } from '../home/lib/trackClassTaken';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { Back } from '../../../../shared/components/icons/Back';
import { OsehColors } from '../../../../shared/OsehColors';

/**
 * A relatively basic screen which presents an emotion and allows the user to
 * take a 1-minute or longer class based on that emotion.
 *
 * This is suffixed with "Component" to avoid naming conflicts.
 */
export const EmotionComponent = ({
  ctx,
  screen,
  startPop,
}: ScreenComponentProps<'emotion', EmotionResources, EmotionMappedParams>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="space-between">
        <div className={styles.back}>
          {screen.parameters.back && (
            <IconButton
              icon={
                <Back
                  icon={{ width: 20 }}
                  container={{ width: 36, height: 52 }}
                  color={OsehColors.v4.primary.light}
                  startPadding={{ x: { fraction: 0.5 }, y: { fraction: 1 } }}
                />
              }
              srOnlyName="Back"
              onClick={() => {
                const btn = screen.parameters.back;
                if (btn === null) {
                  return;
                }
                configurableScreenOut(workingVWC, startPop, transition, btn.exit, btn.trigger);
              }}
            />
          )}
        </div>
        <div className={styles.center}>
          <div className={styles.header}>{screen.parameters.header}</div>
          <VerticalSpacer height={6} />
          <div className={styles.emotion}>{screen.parameters.emotion}</div>
          {screen.parameters.subheader && (
            <>
              <VerticalSpacer height={16} />
              <div className={styles.subheader}>{screen.parameters.subheader}</div>
            </>
          )}
        </div>
        <div className={styles.bottom}>
          {screen.parameters.short && (
            <Button
              type="button"
              variant="filled-white"
              onClick={async (e) => {
                e.preventDefault();
                const btn = screen.parameters.short;
                if (btn === null) {
                  return;
                }
                configurableScreenOut(workingVWC, startPop, transition, btn.exit, btn.trigger, {
                  endpoint: '/api/1/users/me/screens/pop_to_emotion_class',
                  parameters: {
                    emotion: screen.parameters.emotion,
                    premium: false,
                  },
                  beforeDone: async () => {
                    trackClassTaken(ctx);
                  },
                });
              }}>
              {screen.parameters.short.text}
            </Button>
          )}
          {screen.parameters.short && screen.parameters.long && <VerticalSpacer height={12} />}
          {screen.parameters.long && (
            <Button
              type="button"
              variant="filled-premium"
              onClick={async (e) => {
                e.preventDefault();
                const btn = screen.parameters.long;
                if (btn === null) {
                  return;
                }
                configurableScreenOut(workingVWC, startPop, transition, btn.exit, btn.trigger, {
                  endpoint: '/api/1/users/me/screens/pop_to_emotion_class',
                  parameters: {
                    emotion: screen.parameters.emotion,
                    premium: true,
                  },
                  beforeDone: async () => {
                    trackClassTaken(ctx);
                  },
                });
              }}>
              {screen.parameters.long.text}
            </Button>
          )}
          <VerticalSpacer height={32} />
        </div>
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
