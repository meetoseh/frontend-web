import { ReactElement } from 'react';
import { FeaturesState } from './hooks/useFeaturesState';

type FeaturesRouterProps = {
  /**
   * The current features state. If required is false, the router
   * renders an empty fragment.
   */
  state: FeaturesState;
};

/**
 * Uses the state from the useFeaturesState hook to render an injected
 * screen related to one of the apps features. This includes gathering
 * additional information or providing additional context.
 */
export const FeaturesRouter = ({ state }: FeaturesRouterProps): ReactElement => {
  if (!state.required || state.loading) {
    return <></>;
  }

  return state.feature ?? <></>;
};
