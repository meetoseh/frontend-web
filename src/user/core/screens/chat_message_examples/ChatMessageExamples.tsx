import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import { ScreenComponentProps } from '../../models/Screen';
import { ChatMessageExamplesMappedParams } from './ChatMessageExamplesParams';
import { ChatMessageExamplesResources } from './ChatMessageExamplesResources';
import styles from './ChatMessageExamples.module.css';
import { Fragment, ReactElement } from 'react';
import { Button } from '../../../../shared/forms/Button';
import { screenOut } from '../../lib/screenOut';

/**
 * An interstitial screen designed specifically to help provide examples
 * of how to use the journal chat screen
 */
export const ChatMessageExamples = ({
  ctx,
  screen,
  startPop,
}: ScreenComponentProps<
  'chat_message_examples',
  ChatMessageExamplesResources,
  ChatMessageExamplesMappedParams
>): ReactElement => {
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
        justifyContent="flex-start"
        gridSizeVWC={ctx.windowSizeImmediate}>
        <VerticalSpacer height={0} flexGrow={2} />
        <div className={styles.header}>{screen.parameters.header}</div>
        <VerticalSpacer height={0} maxHeight={16} flexGrow={1} />
        <div className={styles.body}>{screen.parameters.body}</div>
        <VerticalSpacer height={0} maxHeight={48} flexGrow={1} />
        {screen.parameters.messages.map((message, index) => (
          <Fragment key={index}>
            {index > 0 && <VerticalSpacer height={0} maxHeight={24} flexGrow={1} />}
            <div
              className={
                index % 2 === 0 ? styles.messageEvenContainer : styles.messageOddContainer
              }>
              <div className={styles.message}>{message}</div>
            </div>
          </Fragment>
        ))}
        <VerticalSpacer height={8} flexGrow={1} />
        <Button
          type="button"
          variant="filled-white"
          onClick={(e) => {
            e.preventDefault();
            screenOut(
              workingVWC,
              startPop,
              transition,
              screen.parameters.exit,
              screen.parameters.trigger
            );
          }}>
          {screen.parameters.cta}
        </Button>
        <VerticalSpacer height={0} maxHeight={32} flexGrow={1} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
