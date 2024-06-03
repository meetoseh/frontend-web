import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import {
  TransitionPropAsOwner,
  playEntranceTransition,
  playExitTransition,
} from '../../../shared/lib/TransitionProp';
import { setVWC } from '../../../shared/lib/setVWC';
import { screenWithWorking } from './screenWithWorking';
import { ScreenStartPop } from '../models/Screen';

/**
 * The standard screen out handler which plays the given exit transition and
 * triggers the given trigger.
 *
 * Can use null for workingVWC to skip that logic (usually when adding additional
 * logic and composing this function)
 */
export const screenOut = async <T extends string, C extends { type: T; ms: number }>(
  workingVWC: WritableValueWithCallbacks<boolean> | null,
  startPop: ScreenStartPop,
  transition: TransitionPropAsOwner<T, C>,
  exit: C,
  trigger: string | null,
  opts?: {
    endpoint?: string;
    parameters?: any;
    beforeDone?: () => Promise<void>;
    afterDone?: () => void;
    onError?: (error: unknown) => void;
  }
): Promise<void> => {
  screenWithWorking(workingVWC, async () => {
    setVWC(transition.animation, exit);

    const exitTransitionCancelable = playExitTransition(transition);

    const finishPop = startPop(
      trigger === null
        ? null
        : {
            slug: trigger,
            parameters: opts?.parameters ?? {},
          },
      trigger === null ? undefined : opts?.endpoint,
      trigger === null || opts?.onError === undefined
        ? undefined
        : ((onError) => {
            return (err) => {
              onError(err);
              exitTransitionCancelable.promise.finally(() => {
                playEntranceTransition(transition);
              });
            };
          })(opts.onError)
    );
    await Promise.all([
      exitTransitionCancelable.promise.catch(() => {}),
      opts?.beforeDone?.() ?? Promise.resolve(),
    ]);
    finishPop();
    opts?.afterDone?.();
  });
};
