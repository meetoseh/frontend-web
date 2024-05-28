import { WritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { setVWC } from '../../../shared/lib/setVWC';

/**
 * Convenience function which only runs the given handler while the
 * working vwc lock is set to true. To make this composable, workingVWC
 * can be null for the inner parts for this function to just delegate
 * to handler without setting the working vwc lock.
 */
export const screenWithWorking = async (
  workingVWC: WritableValueWithCallbacks<boolean> | null,
  handler: () => Promise<void>
): Promise<void> => {
  if (workingVWC !== null) {
    if (workingVWC.get()) {
      return;
    }
    setVWC(workingVWC, true);
  }

  try {
    await handler();
  } finally {
    if (workingVWC !== null) {
      setVWC(workingVWC, false);
    }
  }
};
