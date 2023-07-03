import { ReactElement } from 'react';
import { FeatureAllStates } from './FeatureAllStates';
import { ValueWithCallbacks } from '../../../shared/lib/Callbacks';

export type FeatureComponentProps<T extends object, J extends { loading: boolean }> = {
  state: ValueWithCallbacks<T>;
  resources: ValueWithCallbacks<J>;
};

export type Feature<T extends object, J extends { loading: boolean }> = {
  /**
   * The key for this steps state in FeatureAllStates.
   */
  identifier: keyof FeatureAllStates;

  /**
   * Acts as a hook for the state of this step as is pertinent to determining if
   * this step should be rendered. This is also the only state that other steps
   * will be able to access.
   *
   * This should never trigger react rerenders, since it's lifted to near the
   * root.
   */
  useWorldState: () => ValueWithCallbacks<T>;

  /**
   * A standard react hook for the resources required to render the component
   * for this step. The resources can depend on this steps state and on other
   * steps states.
   *
   * Most resources should only be loaded if the step is required, and should
   * be unloaded once the step is no longer required.
   */
  useResources: (
    worldState: ValueWithCallbacks<T>,
    required: ValueWithCallbacks<boolean>,
    allStates: ValueWithCallbacks<FeatureAllStates>
  ) => ValueWithCallbacks<J>;

  /**
   * Determines if the given states warrant this step being rendered.
   */
  isRequired: (worldState: T, allStates: FeatureAllStates) => boolean | undefined;

  /**
   * Creates the component for this step. from just this steps state and resources.
   */
  component: (worldState: ValueWithCallbacks<T>, resources: ValueWithCallbacks<J>) => ReactElement;
};
