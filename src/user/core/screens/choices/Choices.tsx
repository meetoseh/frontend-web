import { ReactElement, useEffect, useMemo } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './Choices.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import {
  WritableValueWithTypedCallbacks,
  downgradeTypedVWC,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { ChoicesResources } from './ChoicesResources';
import { ChoicesMappedParams } from './ChoicesParams';
import { AutoBold } from '../../../../shared/components/AutoBold';
import { SurveyCheckboxGroup } from '../../../../shared/components/SurveyCheckboxGroup';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { configurableScreenOut } from '../../lib/configurableScreenOut';

/**
 * Asks the user a question and they select their response. Can choose one or
 * multiple depending on how the screen is configured.
 */
export const Choices = ({
  ctx,
  screen,
  resources,
  trace,
  startPop,
}: ScreenComponentProps<'choices', ChoicesResources, ChoicesMappedParams>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const choicesMapped = useMemo(
    () =>
      screen.parameters.choices.map((c, idx) => ({
        slug: makeSlug(c, idx),
        element: <>{c}</>,
      })),
    [screen.parameters.choices]
  );
  const checkedVWC = useWritableValueWithCallbacks<string[]>(
    () => []
  ) as WritableValueWithTypedCallbacks<
    string[],
    { action: 'checked' | 'unchecked'; changed: string } | undefined
  >;

  useEffect(() => {
    checkedVWC.callbacks.add(handleEvent);
    return () => {
      checkedVWC.callbacks.remove(handleEvent);
    };

    function handleEvent(event: { action: 'checked' | 'unchecked'; changed: string } | undefined) {
      if (event === undefined) {
        trace({ type: 'checked-changed', slug: screen.parameters.slug, value: checkedVWC.get() });
        return;
      }

      trace({
        type: 'checked-changed',
        slug: screen.parameters.slug,
        action: event.action,
        changed: event.changed,
        value: checkedVWC.get(),
      });
    }
  }, [checkedVWC, resources, screen.parameters.slug, trace]);

  const canContinueVWC = useMappedValueWithCallbacks(
    downgradeTypedVWC(checkedVWC),
    (checked) => checked.length > 0 || !screen.parameters.enforce
  );

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        justifyContent="space-between"
        gridSizeVWC={ctx.windowSizeImmediate}>
        <VerticalSpacer height={32} />
        <div className={styles.top}>{screen.parameters.top}</div>
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.header}>{screen.parameters.header}</div>
        {screen.parameters.message === null ? null : (
          <>
            <VerticalSpacer height={16} />
            <AutoBold className={styles.message} message={screen.parameters.message} />
          </>
        )}
        <VerticalSpacer height={32} />
        <SurveyCheckboxGroup
          choices={choicesMapped}
          checked={checkedVWC}
          variant={screen.parameters.multiple ? 'square' : 'round'}
          multiple={screen.parameters.multiple}
          uncheck={screen.parameters.multiple}
        />
        <VerticalSpacer height={0} flexGrow={1} />
        <RenderGuardedComponent
          props={canContinueVWC}
          component={(canContinue) => (
            <Button
              type="button"
              variant="filled-white"
              disabled={!canContinue}
              onClick={(e) => {
                e.preventDefault();
                if (!canContinue) {
                  return;
                }

                configurableScreenOut(
                  workingVWC,
                  startPop,
                  transition,
                  screen.parameters.exit,
                  screen.parameters.trigger,
                  {
                    parameters: screen.parameters.includeChoice
                      ? { checked: checkedVWC.get() }
                      : undefined,
                    beforeDone: async () => {
                      trace({ type: 'cta', slug: screen.parameters.slug, value: checkedVWC.get() });
                    },
                  }
                );
              }}>
              {screen.parameters.cta}
            </Button>
          )}
        />
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};

const makeSlug = (choice: string, idx: number): string => `[${idx}] ${choice}`;
