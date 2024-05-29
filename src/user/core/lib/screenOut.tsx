import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { TransitionPropAsOwner, playExitTransition } from '../../../shared/lib/TransitionProp';
import { setVWC } from '../../../shared/lib/setVWC';
import { screenWithWorking } from './screenWithWorking';

/**
 * The standard screen out handler which plays the given exit transition and
 * triggers the given trigger.
 *
 * Can use null for workingVWC to skip that logic (usually when adding additional
 * logic and composing this function)
 */
export const screenOut = async <T extends string, C extends { type: T; ms: number }>(
  workingVWC: WritableValueWithCallbacks<boolean> | null,
  startPop: (trigger: { slug: string; parameters: any } | null, endpoint?: string) => () => void,
  transition: TransitionPropAsOwner<T, C>,
  exit: C,
  trigger: string | null,
  opts?: {
    endpoint?: string;
    parameters?: any;
    beforeDone?: () => Promise<void>;
  }
): Promise<void> => {
  screenWithWorking(workingVWC, async () => {
    const finishPop = startPop(
      trigger === null
        ? null
        : {
            slug: trigger,
            parameters: opts?.parameters ?? {},
          },
      trigger === null ? undefined : opts?.endpoint
    );
    setVWC(transition.animation, exit);
    await Promise.all([
      playExitTransition(transition).promise,
      opts?.beforeDone?.() ?? Promise.resolve(),
    ]);
    finishPop();
  });
};
