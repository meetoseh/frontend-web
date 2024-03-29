import { FeatureComponentProps } from '../../models/Feature';
import { GoalCategoriesResources } from './GoalCategoriesResources';
import { GoalCategoriesState } from './GoalCategoriesState';
import { ReactElement, useCallback, useEffect } from 'react';
import {
  WritableValueWithTypedCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { SurveyCheckboxGroup } from '../../../../shared/components/SurveyCheckboxGroup';
import { SurveyScreen, SurveyScreenTransition } from '../../../../shared/components/SurveyScreen';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import {
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import { setVWC } from '../../../../shared/lib/setVWC';

const _CHOICES = [
  { slug: 'sleep_better', text: 'Sleep Better', element: <>Sleep Better</> },
  { slug: 'increase_focus', text: 'Increase Focus', element: <>Increase Focus</> },
  { slug: 'reduce_stress', text: 'Reduce Stress + Anxiety', element: <>Reduce Stress + Anxiety</> },
  { slug: 'be_present', text: 'Be Present', element: <>Be Present</> },
] as const;

type ChoiceSlug = (typeof _CHOICES)[number]['slug'];
const CHOICES = _CHOICES as readonly { slug: ChoiceSlug; text: string; element: ReactElement }[];

/**
 * Shows the actual goal categories question
 */
export const GoalCategories = ({
  state,
  resources,
}: FeatureComponentProps<GoalCategoriesState, GoalCategoriesResources>) => {
  const transition = useTransitionProp((): SurveyScreenTransition => {
    const enter = state.get().forced?.enter ?? 'fade';
    if (enter === 'fade') {
      return { type: 'fade', ms: 350 };
    } else if (enter === 'swipe-left') {
      return { type: 'swipe', direction: 'to-left', ms: 350 };
    } else {
      return { type: 'swipe', direction: 'to-right', ms: 350 };
    }
  });
  const checkedVWC = useWritableValueWithCallbacks<ChoiceSlug[]>(
    () => []
  ) as WritableValueWithTypedCallbacks<
    ChoiceSlug[],
    { action: 'checked' | 'unchecked'; changed: ChoiceSlug } | undefined
  >;

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
          choices: CHOICES.map(({ slug, text }) => ({ slug, text })),
          checked: checkedVWC.get(),
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
      if (event === undefined) {
        return;
      }

      resources.get().session?.storeAction(event.action === 'checked' ? 'check' : 'uncheck', {
        slug: event.changed,
      });
    }
  }, [checkedVWC, resources]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };

    function handleBeforeUnload() {
      resources.get().session?.storeAction('close', {
        checked: checkedVWC.get(),
      });
    }
  }, [resources]);

  const handleContinue = useCallback(async () => {
    resources.get().session?.storeAction('continue', {
      checked: checkedVWC.get(),
    });
    setVWC(transition.animation, { type: 'swipe', direction: 'to-left', ms: 350 });
    await playExitTransition(transition).promise;
    resources.get().session?.reset();
    state.get().ian?.onShown();
    resources.get().onContinue();
  }, [resources, state]);

  return (
    <SurveyScreen
      title={{
        type: 'react-rerender',
        props: <>What are your goals?</>,
      }}
      subtitle={{
        type: 'react-rerender',
        props: <>We&rsquo;ll use this to personalize your experience</>,
      }}
      onBack={{
        type: 'react-rerender',
        props: null,
      }}
      onContinue={{
        type: 'react-rerender',
        props: handleContinue,
      }}
      transition={transition}>
      <SurveyCheckboxGroup
        choices={CHOICES}
        checked={checkedVWC}
        variant="square"
        uncheck
        multiple
      />
    </SurveyScreen>
  );
};
