import { ReactElement } from 'react';
import { FeatureAllStates } from './FeatureAllStates';

export type AnticipateStateFn<T extends object> = (state: T, pending: Promise<void>) => void;
export type FeatureComponentProps<T extends object, J extends { loading: boolean }> = {
  state: T;
  resources: J;
  doAnticipateState: AnticipateStateFn<T>;
};

export type Feature<T extends object, J extends { loading: boolean }> = {
  /**
   * The key for this steps state in FeatureAllStates.
   */
  identifier: keyof FeatureAllStates;

  /**
   * Acts as a standard react hook for the state of this step as is pertinent
   * to determining if this step should be rendered. This is also the only
   * state that other steps will be able to access.
   */
  useWorldState: () => T;

  /**
   * A standard react hook for the resources required to render the component
   * for this step. The resources can depend on this steps state and on other
   * steps states.
   *
   * Most resources should only be loaded if the step is required, and should
   * be unloaded once the step is no longer required.
   *
   * The step may choose to return undefined when not required, though often that
   * is more tedious than just returning a loading state.
   */
  useResources: (worldState: T, required: boolean, allStates: FeatureAllStates) => J | undefined;

  /**
   * Determines if the given states warrant this step being rendered.
   */
  isRequired: (worldState: T, allStates: FeatureAllStates) => boolean | undefined;

  /**
   * Creates the component for this step. from just this steps state and resources.
   *
   * Passed a function which must only be called in a privileged context when
   * the step is likely to unmount, such as the user clicking the submit button
   * on a form. The function is passed the state that this step is expected to be
   * in after this action resolves, which will be used via the isRequired function
   * to determine the next step that might be mounted. If the next step which might
   * be mounted is found, its onMountingSoon function is called.
   */
  component: (worldState: T, resources: J, doAnticipateState: AnticipateStateFn<T>) => ReactElement;

  /**
   * Called if this steps component is likely to be mounted soon, pending the
   * given promise not being rejected. This is called with the state that this
   * step is expected to be in after the promise resolves.
   *
   * This can perform actions that are only available in privileged contexts,
   * such as starting audio or going fullscreen, so long as it can undo
   * those actions if the promise is rejected.
   */
  onMountingSoon?: (
    worldState: T,
    resources: J | undefined,
    pending: Promise<void>,
    allStates: FeatureAllStates
  ) => void;
};
