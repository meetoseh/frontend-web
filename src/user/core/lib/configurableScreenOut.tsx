import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { TransitionPropAsOwner } from '../../../shared/lib/TransitionProp';
import { ScreenStartPop } from '../models/Screen';
import { ScreenConfigurableTrigger } from '../models/ScreenConfigurableTrigger';
import { screenOut } from './screenOut';

/**
 * The standard screen out handler which plays the given exit transition and
 * triggers the given trigger. Unlike the raw `screenOut` function, this accepts
 * the standard description of a trigger, rather than a flow slug, endpoint, and
 * parameters separately.
 *
 * Can use null for workingVWC to skip that logic (usually when adding additional
 * logic and composing this function)
 */
export const configurableScreenOut = async <T extends string, C extends { type: T; ms: number }>(
  workingVWC: WritableValueWithCallbacks<boolean> | null,
  startPop: ScreenStartPop,
  transition: TransitionPropAsOwner<T, C>,
  exit: C,
  trigger: ScreenConfigurableTrigger,
  opts?: {
    endpoint?: string;
    parameters?: any;
    beforeDone?: () => Promise<void>;
    afterDone?: () => void;
    onError?: (error: unknown) => void;
  }
): Promise<void> => {
  const endpoint = trigger?.endpoint ?? opts?.endpoint;
  const parameters = (() => {
    const configuredParameters = trigger.type === 'flow' ? trigger.parameters : null;
    const basicParameters = opts?.parameters ?? null;
    if (configuredParameters === null && basicParameters === null) {
      return undefined;
    }
    return Object.assign({}, basicParameters, configuredParameters);
  })();
  const flow =
    trigger.type === 'flow'
      ? trigger.flow
      : endpoint !== undefined || parameters !== undefined
      ? 'skip'
      : null;
  screenOut(workingVWC, startPop, transition, exit, flow, {
    endpoint,
    parameters,
    beforeDone: opts?.beforeDone,
    afterDone: opts?.afterDone,
    onError: opts?.onError,
  });
};
