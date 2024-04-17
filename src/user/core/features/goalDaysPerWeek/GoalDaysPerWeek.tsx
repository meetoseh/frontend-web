import { FeatureComponentProps } from '../../models/Feature';
import { ReactElement, useCallback, useContext, useEffect } from 'react';
import {
  WritableValueWithTypedCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { SurveyCheckboxGroup } from '../../../../shared/components/SurveyCheckboxGroup';
import { SurveyScreen } from '../../../../shared/components/SurveyScreen';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { GoalDaysPerWeekState } from './GoalDaysPerWeekState';
import { GoalDaysPerWeekResources } from './GoalDaysPerWeekResources';
import { apiFetch } from '../../../../shared/ApiConstants';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { useWorkingModal } from '../../../../shared/hooks/useWorkingModal';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import { setVWC } from '../../../../shared/lib/setVWC';
import { describeError } from '../../../../shared/forms/ErrorBlock';
import {
  playEntranceTransition,
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import { StandardScreenTransition } from '../../../../shared/hooks/useStandardTransitions';

const _CHOICES = [
  { slug: '1', text: '1 day', element: <>1 day</> },
  { slug: '2', text: '2 days', element: <>2 days</> },
  { slug: '3', text: '3 days', element: <>3 days</> },
  { slug: '4', text: '4 days', element: <>4 days</> },
  { slug: '5', text: '5 days', element: <>5 days</> },
  { slug: '6', text: '6 days', element: <>6 days</> },
  { slug: '7', text: '7 days', element: <>7 days</> },
] as const;

type ChoiceSlug = (typeof _CHOICES)[number]['slug'];
const CHOICES = _CHOICES as readonly { slug: ChoiceSlug; text: string; element: ReactElement }[];

/**
 * Shows the actual goal days per week question
 */
export const GoalDaysPerWeek = ({
  state,
  resources,
}: FeatureComponentProps<GoalDaysPerWeekState, GoalDaysPerWeekResources>) => {
  const transition = useTransitionProp((): StandardScreenTransition => {
    const back = state.get().forced?.back ?? null;
    if (back === null) {
      return { type: 'fade', ms: 350 };
    } else {
      return { type: 'swipe', direction: 'to-left', ms: 350 };
    }
  });
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const checkedVWC = useWritableValueWithCallbacks<ChoiceSlug[]>(() => [
    resources.get().initialGoal.toString() as ChoiceSlug,
  ]) as WritableValueWithTypedCallbacks<
    ChoiceSlug[],
    { action: 'checked' | 'unchecked'; changed: ChoiceSlug } | undefined
  >;
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const savingVWC = useWritableValueWithCallbacks<boolean>(() => false);

  useErrorModal(modalContext.modals, errorVWC, 'saving goal');

  useWorkingModal(modalContext.modals, savingVWC, { delayStartMs: 200 });

  useEntranceTransition(transition);

  useStartSession(
    {
      type: 'callbacks',
      props: () => resources.get().session,
      callbacks: resources.callbacks,
    },
    {
      onStart: () => {
        resources.get().session?.storeAction('open', {
          choice: parseInt(checkedVWC.get()[0], 10),
          back: state.get().forced?.back ?? null,
        });
      },
    }
  );

  useEffect(() => {
    checkedVWC.callbacks.add(handleEvent);
    return () => {
      checkedVWC.callbacks.remove(handleEvent);
    };

    function handleEvent(
      event: { action: 'checked' | 'unchecked'; changed: ChoiceSlug } | undefined
    ) {
      if (event === undefined || event.action !== 'checked') {
        return;
      }

      resources.get().session?.storeAction('check', {
        value: parseInt(event.changed, 10),
      });
    }
  }, [checkedVWC, resources]);

  const trySave = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;
    const value = parseInt(checkedVWC.get()[0], 10);

    const response = await apiFetch(
      '/api/1/users/me/goal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ days_per_week: value }),
        keepalive: true,
      },
      loginContext
    );
    if (response.ok) {
      resources.get().session?.storeAction('stored', { choice: value });
    }
  }, [checkedVWC, loginContextRaw.value, resources]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };

    function handleBeforeUnload() {
      const value = parseInt(checkedVWC.get()[0], 10);
      resources.get().session?.storeAction('close', {
        choice: value,
      });
      trySave();
    }
  }, [resources, checkedVWC, trySave]);

  const handleAction = useCallback(
    async (action: 'continue' | 'back') => {
      const choice = parseInt(checkedVWC.get()[0], 10);
      resources.get().session?.storeAction(action, {
        choice,
      });
      if (action === 'back') {
        setVWC(transition.animation, { type: 'swipe', direction: 'to-right', ms: 350 });
      } else {
        setVWC(transition.animation, { type: 'fade', ms: 350 });
      }
      await playExitTransition(transition).promise;
      setVWC(errorVWC, null);
      try {
        await trySave();
      } catch (e) {
        setVWC(errorVWC, await describeError(e));
        await playEntranceTransition(transition).promise;
        return;
      }
      resources.get().session?.reset();
      state.get().ian?.onShown();
      resources.get().onGoalSet(choice, action);
    },
    [resources, state, checkedVWC, errorVWC, transition, trySave]
  );

  return (
    <SurveyScreen
      title={{
        type: 'react-rerender',
        props: <>How many days a week would you like to practice each week?</>,
      }}
      subtitle={{
        type: 'react-rerender',
        props: <>We&rsquo;ll keep you motivated along the way</>,
      }}
      onBack={{
        type: 'callbacks',
        props: () => {
          const forced = state.get().forced;
          if (forced === null || forced.back === null) {
            return null;
          }
          return () => handleAction('back');
        },
        callbacks: state.callbacks,
      }}
      onContinue={{
        type: 'react-rerender',
        props: () => handleAction('continue'),
      }}
      transition={transition}>
      <SurveyCheckboxGroup choices={CHOICES} checked={checkedVWC} variant="round" />
    </SurveyScreen>
  );
};
