import { ReactElement, useCallback, useContext, useEffect, useMemo } from 'react';
import { HomeScreenTutorialResources } from './HomeScreenTutorialResources';
import { HomeScreenTutorialState } from './HomeScreenTutorialState';
import { FeatureComponentProps } from '../../models/Feature';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useStartSession } from '../../../../shared/hooks/useInappNotificationSession';
import { HomeScreen } from '../homeScreen/HomeScreen';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { HomeScreenState } from '../homeScreen/HomeScreenState';
import { HomeScreenResources } from '../homeScreen/HomeScreenResources';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';

/**
 * Renders a two-step home screen tutorial; this looks similar to the home screen, except
 * with overlays and instructions to guide the user through the available features.
 */
export const HomeScreenTutorial = ({
  state,
  resources,
}: FeatureComponentProps<HomeScreenTutorialState, HomeScreenTutorialResources>): ReactElement => {
  const stepVWC = useWritableValueWithCallbacks<'explain_top' | 'explain_bottom'>(
    () => 'explain_top'
  );

  useEffect(() => {
    resources.get().onMount();
  }, [resources]);

  useStartSession(
    {
      type: 'callbacks',
      props: () => resources.get().session,
      callbacks: resources.callbacks,
    },
    {
      onStart: () => {
        resources.get().session?.storeAction('open', {
          step: stepVWC.get(),
        });
      },
    }
  );

  const onNextStep = useCallback(async () => {
    const step = stepVWC.get();

    if (step === 'explain_top') {
      setVWC(stepVWC, 'explain_bottom');
      resources.get().session?.storeAction('next', {
        step: 'explain_bottom',
      });
    } else {
      try {
        await resources.get().session?.storeAction('next', {
          step: null,
        });
      } finally {
        resources.get().session?.reset();
        state.get().ian?.onShown();
      }
    }
  }, [stepVWC, resources, state]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };

    function handleBeforeUnload() {
      resources.get().session?.storeAction('close', null);
    }
  }, [resources]);

  const tutorial = useMemo(
    () => ({
      step: stepVWC,
      onNextStep,
    }),
    [stepVWC, onNextStep]
  );

  const mappedState = useMappedValuesWithCallbacks(
    [resources],
    (): HomeScreenState => ({
      imageHandler: resources.get().imageHandler,
      streakInfo: resources.get().streakInfo,
      sessionInfo: resources.get().sessionInfo,
      nextEnterTransition: undefined,
      onClassTaken: () => {},
      setNextEnterTransition: () => {},
    })
  );

  const loginContextRaw = useContext(LoginContext);
  const nameVWC = useMappedValueWithCallbacks(loginContextRaw.value, (loginContextUnch) => {
    if (loginContextUnch.state !== 'logged-in') {
      return '';
    }
    const loginContext = loginContextUnch;
    const name = loginContext.userAttributes.givenName;
    if (name === null || name.toLowerCase() === 'anonymous' || name.toLowerCase() === 'there') {
      return '';
    }
    if (name.startsWith('Guest-')) {
      return ', Guest';
    }
    return `, ${loginContext.userAttributes.givenName}`;
  });
  const currentDate = useMemo(() => new Date(), []);
  const mappedResources = useMappedValuesWithCallbacks(
    [resources, nameVWC],
    (): HomeScreenResources => ({
      loading: resources.get().loading,
      backgroundImage: resources.get().backgroundImage,
      emotions: {
        type: 'success',
        result: [
          'calm',
          'hopeful',
          'focused',
          'energized',
          'inspired',
          'creative',
          'open',
          'grounded',
          'loved',
          'balanced',
          'content',
          'valued',
          'safe',
          'confident',
          'sleepy',
        ].map((word) => ({ word, antonym: '' })),
        error: null,
        refresh: () => {},
        replace: () => {},
      },
      copy: {
        type: 'success',
        result: {
          headline:
            (() => {
              const hour = currentDate.getHours();
              if (hour >= 3 && hour < 12) {
                return 'Good Morning';
              } else if (hour >= 12 && hour < 17) {
                return 'Good Afternoon';
              } else {
                return 'Good Evening';
              }
            })() + nameVWC.get(),
          subheadline: '“A journey of a thousand miles begins with a single step” —Lao Tzu',
        },
        error: null,
        refresh: () => {},
        replace: () => {},
      },
      gotoAccount: () => {},
      gotoSeries: () => {},
      startGotoEmotion: () => () => {},
      gotoUpdateGoal: () => {},
    })
  );

  return <HomeScreen state={mappedState} resources={mappedResources} tutorial={tutorial} />;
};
