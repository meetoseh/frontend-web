import { ReactElement } from 'react';
import { OnboardingState } from './hooks/useOnboardingState';

type OnboardingRouterProps = {
  /**
   * The current onboarding state. If required is false, the router
   * renders an empty fragment.
   */
  state: OnboardingState;
};

/**
 * Uses the state from the useOnboardingState hook to render an injected
 * screen which helps onboard the user onto the app. This includes gathering
 * additional information or providing additional context.
 */
export const OnboardingRouter = ({ state }: OnboardingRouterProps): ReactElement => {
  if (!state.required || state.loading) {
    return <></>;
  }

  return state.step ?? <></>;
};
