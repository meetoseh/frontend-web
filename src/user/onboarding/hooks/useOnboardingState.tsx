import { ReactElement, useMemo, useRef } from 'react';
import { RequestPhoneStep } from '../steps/requestPhone/RequestPhoneStep';
import { RequestNameStep } from '../steps/requestName/RequestNameStep';
import { OnboardingAllStates } from '../models/OnboardingAllStates';
import { SignupRewardStep } from '../steps/signupReward/SignupRewardStep';
import { DailyGoalStep } from '../steps/dailyGoal/DailyGoalStep';
import { OnboardingClassStep } from '../steps/onboardingClass/OnboardingClassStep';
import { IntrospectionStep } from '../steps/introspection/IntrospectionStep';
import { RequestNotificationTimeStep } from '../steps/requestNotificationTime/RequestNotificationTimeStep';
import { YourJourneyStep } from '../steps/yourJourney/YourJourneyStep';

export type OnboardingState = {
  /**
   * True if we're waiting for more information to determine the
   * onboarding state, false otherwise.
   */
  loading: boolean;

  /**
   * True if additional onboarding steps are required, false
   */
  required: boolean;

  /**
   * The step to render, or null if no step should be rendered.
   */
  step: ReactElement | null;
};

const steps = [
  RequestNameStep,
  SignupRewardStep,
  RequestPhoneStep,
  DailyGoalStep,
  OnboardingClassStep,
  IntrospectionStep,
  RequestNotificationTimeStep,
  YourJourneyStep,
];

/**
 * Determines the current state of onboarding the user onto the website. If
 * a screen should be injected related to onboarding, then the required
 * property will be true and this state should be forwarded to the OnboardingRouter.
 */
export const useOnboardingState = (): OnboardingState => {
  const states = steps.map((s) => s.useWorldState());
  const allStates = useMemo(() => {
    const result = {} as any;
    for (let i = 0; i < steps.length; i++) {
      result[steps[i].identifier] = states[i];
    }
    return result as OnboardingAllStates;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, states);
  const requiredArr = steps.map((s, idx) => s.isRequired(states[idx] as any, allStates));
  const resources = steps.map((s, idx) =>
    s.useResources(states[idx] as any, requiredArr[idx] ?? false, allStates)
  );

  const firstRequiredIdx = requiredArr.findIndex((r) => r);
  const loading =
    (firstRequiredIdx === -1 && requiredArr.some((r) => r === undefined)) ||
    requiredArr.slice(0, firstRequiredIdx).some((r) => r === undefined);
  const firstRequired =
    firstRequiredIdx < 0
      ? undefined
      : {
          step: steps[firstRequiredIdx],
          state: states[firstRequiredIdx],
          resources: resources[firstRequiredIdx],
        };

  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;

  const step = useMemo<ReactElement | null>(() => {
    if (firstRequired?.step === undefined || loading) {
      return null;
    }

    return (firstRequired.step.component as any).call(
      undefined,
      firstRequired.state,
      firstRequired.resources,
      (worldState: any, pending: Promise<void>) => {
        const newAllStates = (() => {
          const result = {} as any;
          for (const [key, value] of Object.entries(allStates)) {
            if (key === firstRequired?.step.identifier) {
              result[key] = worldState;
            } else {
              result[key] = value;
            }
          }
          return result as OnboardingAllStates;
        })();

        const newRequiredArr = steps.map((s, idx) =>
          s.isRequired(newAllStates[s.identifier] as any, newAllStates)
        );

        const newFirstRequiredIdx = newRequiredArr.findIndex((r) => r);
        if (newFirstRequiredIdx < 0) {
          return;
        }

        if (newRequiredArr.slice(0, newFirstRequiredIdx).some((r) => r === undefined)) {
          return;
        }

        if (steps[newFirstRequiredIdx].identifier === firstRequired?.step.identifier) {
          return;
        }

        (steps[newFirstRequiredIdx].onMountingSoon as any)?.call(
          undefined,
          newAllStates[steps[newFirstRequiredIdx].identifier],
          resourcesRef.current[newFirstRequiredIdx],
          pending,
          newAllStates
        );
      }
    );
  }, [loading, firstRequired?.step, firstRequired?.state, firstRequired?.resources, allStates]);

  return useMemo<OnboardingState>(
    () => ({
      loading,
      required: firstRequiredIdx >= 0,
      step,
    }),
    [loading, firstRequiredIdx, step]
  );
};
