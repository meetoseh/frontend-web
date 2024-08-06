import { ReactElement, useContext } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './SetGoal.module.css';
import {
  playEntranceTransition,
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import {
  Callbacks,
  WritableValueWithTypedCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { screenOut } from '../../lib/screenOut';
import { SetGoalResources } from './SetGoalResources';
import { SetGoalMappedParams } from './SetGoalParams';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { useWorkingModal } from '../../../../shared/hooks/useWorkingModal';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../../shared/lib/setVWC';
import { screenWithWorking } from '../../lib/screenWithWorking';
import { apiFetch } from '../../../../shared/ApiConstants';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import { SurveyCheckboxGroup } from '../../../../shared/components/SurveyCheckboxGroup';
import { BackContinue } from '../../../../shared/components/BackContinue';
import { ScreenConfigurableTrigger } from '../../models/ScreenConfigurableTrigger';
import { configurableScreenOut } from '../../lib/configurableScreenOut';

const _CHOICES = [
  { slug: '1', text: '1 day', days: 1, element: <>1 day</> },
  { slug: '2', text: '2 days', days: 2, element: <>2 days</> },
  { slug: '3', text: '3 days', days: 3, element: <>3 days</> },
  { slug: '4', text: '4 days', days: 4, element: <>4 days</> },
  { slug: '5', text: '5 days', days: 5, element: <>5 days</> },
  { slug: '6', text: '6 days', days: 6, element: <>6 days</> },
  { slug: '7', text: '7 days', days: 7, element: <>7 days</> },
] as const;

type ChoiceSlug = (typeof _CHOICES)[number]['slug'];
type Choice = { slug: ChoiceSlug; text: string; days: number; element: ReactElement };

const CHOICES = _CHOICES as readonly Choice[];

/**
 * A basic screen where the user can configure how many days per week they
 * want to practice
 */
export const SetGoal = ({
  ctx,
  screen,
  resources,
  trace,
  startPop,
}: ScreenComponentProps<'set_goal', SetGoalResources, SetGoalMappedParams>): ReactElement => {
  const modalContext = useContext(ModalContext);
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const savingVWC = useWritableValueWithCallbacks<boolean>(() => false);

  useErrorModal(modalContext.modals, errorVWC, 'saving goal');
  useWorkingModal(modalContext.modals, savingVWC, { delayStartMs: 200 });

  const serverGoalVWC = useMappedValueWithCallbacks(
    resources.streak,
    (s) => s?.goalDaysPerWeek ?? null
  );
  const selectedGoalVWC = useWritableValueWithCallbacks<Choice>(() => _CHOICES[2]);
  const checkedWVWC = {
    get: (): ChoiceSlug[] => [selectedGoalVWC.get().slug],
    set: (slug: ChoiceSlug[]) => {
      if (slug.length !== 1) {
        return;
      }

      const match = _CHOICES.find((c) => c.slug === slug[0]);
      if (match !== undefined) {
        selectedGoalVWC.set(match);
      }
    },
    callbacks: selectedGoalVWC.callbacks as Callbacks<
      { action: 'checked' | 'unchecked'; changed: ChoiceSlug } | undefined
    >,
  } as WritableValueWithTypedCallbacks<
    ChoiceSlug[],
    { action: 'checked' | 'unchecked'; changed: ChoiceSlug } | undefined
  >;

  useValueWithCallbacksEffect(serverGoalVWC, (v) => {
    if (v !== null) {
      const match = _CHOICES.find((c) => c.days === v);
      if (match !== undefined) {
        setVWC(selectedGoalVWC, match);
      }
    }
    return undefined;
  });

  useValueWithCallbacksEffect(selectedGoalVWC, (v) => {
    trace({ type: 'selection-changed', days: v.days });
    return undefined;
  });

  /** If the user needs to save, a function to save, otherwise null */
  const prepareSave = (): (() => Promise<boolean>) | null => {
    const selected = selectedGoalVWC.get();
    const server = serverGoalVWC.get();
    if (server === selected.days) {
      return null;
    }

    return async () => {
      if (savingVWC.get()) {
        return false;
      }

      const loginContextUnch = ctx.login.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return false;
      }
      const loginContext = loginContextUnch;

      setVWC(savingVWC, true);
      setVWC(errorVWC, null);
      try {
        const response = await apiFetch(
          '/api/1/users/me/goal',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ days_per_week: selected.days }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
        ctx.resources.streakHandler.evictOrReplace(loginContext, (old) => {
          if (old === undefined) {
            return { type: 'make-request', data: undefined };
          }

          return {
            type: 'data',
            data: {
              ...old,
              goalDaysPerWeek: selected.days,
            },
          };
        });
        return true;
      } catch (e) {
        setVWC(errorVWC, await describeError(e));
        return false;
      } finally {
        setVWC(savingVWC, false);
      }
    };
  };

  const tryExit = ({
    type,
    trigger,
    exit,
  }: {
    type: string;
    trigger: ScreenConfigurableTrigger;
    exit: StandardScreenTransition;
  }) => {
    screenWithWorking(workingVWC, async () => {
      const save = prepareSave();
      if (save === null) {
        trace({ type, draft: false });
        await configurableScreenOut(null, startPop, transition, exit, trigger);
        return;
      }

      trace({ type, draft: true, step: 'save' });
      const exitTransition = playExitTransition(transition);
      const result = await save();
      trace({ type, draft: false, step: 'save', result });
      if (result) {
        const finishPop = startPop(
          trigger.type === 'pop'
            ? null
            : {
                slug: trigger.flow,
                parameters: trigger.parameters,
              },
          trigger.endpoint ?? undefined
        );
        await exitTransition.promise;
        finishPop();
      } else {
        await exitTransition.promise;
        await playEntranceTransition(transition).promise;
      }
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
        <div className={styles.top}>{screen.parameters.top}</div>
        <VerticalSpacer height={0} flexGrow={1} />
        <div className={styles.title}>{screen.parameters.title}</div>
        <VerticalSpacer height={16} />
        <div className={styles.message}>{screen.parameters.message}</div>
        <VerticalSpacer height={32} />
        <SurveyCheckboxGroup choices={CHOICES} checked={checkedWVWC} variant="round" />
        <VerticalSpacer height={0} flexGrow={1} />
        <BackContinue
          onBack={
            screen.parameters.back === null
              ? null
              : (
                  (back) => () =>
                    tryExit({ ...back, type: 'back' })
                )(screen.parameters.back)
          }
          onContinue={() => tryExit({ ...screen.parameters.save, type: 'save' })}
          backText={screen.parameters.back?.text}
          continueText={screen.parameters.save.text}
        />
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
