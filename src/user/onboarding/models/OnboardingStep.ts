import { ReactElement } from 'react';
import { OnboardingAllStates } from './OnboardingAllStates';

export type AnticipateStateFn<T extends object> = (worldState: T, pending: Promise<void>) => void;
export type OnboardingStepComponentProps<T extends object, J extends { loading: boolean }> = {
  state: T;
  resources: J;
  doAnticipateState: AnticipateStateFn<T>;
};

export type OnboardingStep<T extends object, J extends { loading: boolean }> = {
  /**
   * The key for this steps state in OnboardingAllStates.
   */
  identifier: keyof OnboardingAllStates;

  // reactive, the true state of the world
  useWorldState: () => T;

  // semi-reactive like useOsehImageStatesRef
  // this will be called twice, once for the real state (if required)
  // and once for the anticipated state. Should do nothing if required
  // is false (i.e., should always return undefined)
  // worldstate not memoized
  useResources: (worldState: T, required: boolean, allStates: OnboardingAllStates) => J | undefined;

  // if the step is required at the given world state, undefined if we're not sure
  isRequired: (worldState: T, allStates: OnboardingAllStates) => boolean | undefined;

  // renders the component with the given world state and resources,
  // calling the given function with the anticipated world state
  component: (worldState: T, resources: J, doAnticipateState: AnticipateStateFn<T>) => ReactElement;

  onMountingSoon?: (
    worldState: T,
    resources: J | undefined,
    pending: Promise<void>,
    allStates: OnboardingAllStates
  ) => void;
};
