import { useCallback } from 'react';
import { WorkingOverlay } from '../components/WorkingOverlay';
import { Modals, addModalWithCallbackToRemove } from '../contexts/ModalContext';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../lib/Callbacks';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';

export type WorkingModalOpts = {
  title?: string;
  progressBarFraction?: ValueWithCallbacks<number>;
  variant?: 'spinner' | 'nospinner';
  delayStartMs?: number;
};
/**
 * Shows a working modal in the given modals list
 * while working is true
 */
export const useWorkingModal = (
  modals: WritableValueWithCallbacks<Modals>,
  working: ValueWithCallbacks<boolean>,
  opts?: WorkingModalOpts
) => {
  const reallyWorking = useWritableValueWithCallbacks(() => working.get());
  useValueWithCallbacksEffect(working, (val) => {
    if (opts?.delayStartMs === undefined) {
      setVWC(reallyWorking, val);
      return undefined;
    }

    if (!val) {
      setVWC(reallyWorking, false);
      return undefined;
    }

    if (val === reallyWorking.get()) {
      return undefined;
    }

    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setVWC(reallyWorking, true);
    }, opts.delayStartMs);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };
  });

  useValueWithCallbacksEffect(
    reallyWorking,
    useCallback(
      (working) => {
        if (!working) {
          return;
        }

        return addModalWithCallbackToRemove(
          modals,
          <WorkingOverlay
            title={opts?.title}
            progressBarFraction={opts?.progressBarFraction}
            variant={opts?.variant}
          />
        );
      },
      [modals, opts]
    )
  );
};
