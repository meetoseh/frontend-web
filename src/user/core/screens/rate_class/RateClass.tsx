import { ReactElement, useCallback, useContext } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './RateClass.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { RateClassResources } from './RateClassResources';
import { RateClassMappedParams } from './RateClassParams';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import {
  base64URLToByteArray,
  computeAverageRGBAUsingThumbhash,
} from '../../../../shared/lib/colorUtils';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../../shared/lib/setVWC';
import { makePrettyResponse } from '../journey_feedback/lib/makePrettyResponse';
import { GridImageBackground } from '../../../../shared/components/GridImageBackground';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { JourneyFeedback } from '../../../journey/components/JourneyFeedback';
import { storeResponse } from '../journey_feedback/lib/storeResponse';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { DisplayableError } from '../../../../shared/lib/errors';

/**
 * A basic screen where the user can rate a class
 */
export const RateClass = ({
  ctx,
  screen,
  resources,
  trace,
  startPop,
}: ScreenComponentProps<'rate_class', RateClassResources, RateClassMappedParams>): ReactElement => {
  const modalContext = useContext(ModalContext);

  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const backgroundAverageRGBVWC = useMappedValueWithCallbacks(
    resources.background.thumbhash,
    (th): [number, number, number] => {
      if (th === null) {
        return [0, 0, 0];
      }
      const rgba = computeAverageRGBAUsingThumbhash(base64URLToByteArray(th));
      return [rgba[0], rgba[1], rgba[2]];
    }
  );

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const responseVWC = useWritableValueWithCallbacks<number | null>(() => null);
  const feedbackErrorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  useErrorModal(modalContext.modals, feedbackErrorVWC);

  const tracedResponse = useWritableValueWithCallbacks<number | null>(() => null);
  useValueWithCallbacksEffect(responseVWC, (response) => {
    if (response === tracedResponse.get()) {
      return undefined;
    }

    trace({ type: 'changed', response, prettyResponse: makePrettyResponse(response) });
    setVWC(tracedResponse, response);
    return undefined;
  });

  const canContinueVWC = useMappedValueWithCallbacks(responseVWC, (r) => r !== null);
  const storeResponseWrapper = useCallback((): Promise<boolean> => {
    return storeResponse({
      responseVWC,
      trace,
      ctx,
      feedbackErrorVWC,
      journey: screen.parameters.journey,
    });
  }, [responseVWC, trace, ctx, feedbackErrorVWC, screen.parameters.journey]);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridImageBackground
        image={resources.background.image}
        thumbhash={resources.background.thumbhash}
      />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.header}>{screen.parameters.header}</div>
        <VerticalSpacer height={16} />
        <div className={styles.message}>{screen.parameters.message}</div>
        <VerticalSpacer height={32} />
        <JourneyFeedback response={responseVWC} backgroundAverageRGB={backgroundAverageRGBVWC} />
        <VerticalSpacer height={0} flexGrow={1} />
        <RenderGuardedComponent
          props={canContinueVWC}
          component={(canContinue) => (
            <Button
              type="button"
              variant="filled-white"
              onClick={async (e) => {
                e.preventDefault();

                const resp = responseVWC.get();
                if (resp === null) {
                  return;
                }

                const trigger = [
                  screen.parameters.cta.trigger.loved,
                  screen.parameters.cta.trigger.liked,
                  screen.parameters.cta.trigger.disliked,
                  screen.parameters.cta.trigger.hated,
                ][resp - 1] ?? { type: 'pop' };

                configurableScreenOut(
                  workingVWC,
                  startPop,
                  transition,
                  screen.parameters.cta.exit,
                  trigger,
                  {
                    beforeDone: async () => {
                      await storeResponseWrapper();
                    },
                  }
                );
              }}
              disabled={!canContinue}>
              {screen.parameters.cta.text}
            </Button>
          )}
        />
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
