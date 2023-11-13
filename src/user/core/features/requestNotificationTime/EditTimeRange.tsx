import { ReactElement, useCallback, useRef } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import styles from './EditTimeRange.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { Button } from '../../../../shared/forms/Button';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';

/**
 * Describes a time range, e.g., 8am-10am. To avoid ambiguity on days
 * where the time changes, we describe the time range as seconds from
 * the first midnight on the reference day.
 */
export type TimeRange = {
  /** The start of the time range in seconds from midnight */
  start: number;

  /** The end of the time range in seconds from midnight */
  end: number;
};

/**
 * Determines if two time ranges are semantically equivalent
 */
export const areRangesEqual = (a: TimeRange, b: TimeRange): boolean =>
  a.start === b.start && a.end === b.end;

export type EditTimeRangeProps = {
  /**
   * The values for the time range inputs. As the user inputs a new
   * time range, this value will be updated.
   */
  timeRange: WritableValueWithCallbacks<TimeRange>;

  /**
   * Whether the form should be disabled or not.
   */
  disabled: ValueWithCallbacks<boolean>;

  /**
   * Called when the user clicks the continue button.
   */
  onContinue: ValueWithCallbacks<() => void>;
};

/**
 * Renders a form to edit a time range. This is expected to be within a modal,
 * i.e., the page contains a larger form that contains a time range, and if the
 * user wants to edit the time they can tap the time range to open a modal
 * containing this form. Hence, this renders a continue button and assumes that
 * it is instant and can't fail.
 */
export const EditTimeRange = ({
  timeRange,
  disabled,
  onContinue,
}: EditTimeRangeProps): ReactElement => {
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const rawTimeRange = useWritableValueWithCallbacks<TimeRange>(() => ({
    start: timeRange.get().start % 86400,
    end: timeRange.get().end % 86400,
  }));

  useValueWithCallbacksEffect(rawTimeRange, (raw) => {
    if (raw.start <= raw.end) {
      setVWC(timeRange, { start: raw.start, end: raw.end }, areRangesEqual);
    } else {
      setVWC(timeRange, { start: raw.start, end: raw.end + 86400 }, areRangesEqual);
    }
    return undefined;
  });

  const onFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (disabled.get()) {
        return;
      }

      const newStart = inputToSecondsOffset(startRef.current?.value ?? '');
      const newEnd = inputToSecondsOffset(endRef.current?.value ?? '');

      if (newStart !== null && newEnd !== null) {
        setVWC(rawTimeRange, { start: newStart, end: newEnd });
      }

      onContinue.get()();
    },
    [onContinue, disabled, rawTimeRange]
  );

  const onStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newStart = inputToSecondsOffset(e.target.value);
      if (newStart !== null) {
        setVWC(rawTimeRange, { ...rawTimeRange.get(), start: newStart }, areRangesEqual);
      }
    },
    [rawTimeRange]
  );

  const onEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newEnd = inputToSecondsOffset(e.target.value);
      if (newEnd !== null) {
        setVWC(rawTimeRange, { ...rawTimeRange.get(), end: newEnd }, areRangesEqual);
      }
    },
    [rawTimeRange]
  );

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={onFormSubmit}>
        <div className={styles.formItems}>
          <div className={styles.formItem}>
            <label className={styles.formItemTitle} htmlFor="#timeRangeStart">
              Start Time
            </label>
            <input
              type="time"
              className={styles.formItemInput}
              defaultValue={secondsOffsetToInput(rawTimeRange.get().start)}
              onChange={onStartChange}
              ref={startRef}
              id="timeRangeStart"
            />
          </div>
          <div className={styles.formItem}>
            <label className={styles.formItemTitle} htmlFor="#timeRangeEnd">
              End Time
            </label>
            <input
              type="time"
              className={styles.formItemInput}
              defaultValue={secondsOffsetToInput(rawTimeRange.get().end)}
              onChange={onEndChange}
              id="timeRangeEnd"
              ref={endRef}
            />
          </div>
        </div>

        <div className={styles.submitContainer}>
          <RenderGuardedComponent
            props={disabled}
            component={(d) => (
              <Button type="submit" variant="filled-white" fullWidth disabled={d}>
                Continue
              </Button>
            )}
          />
        </div>
      </form>
    </div>
  );
};

const secondsOffsetToInput = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds - hours * 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const inputToSecondsOffset = (input: string): number | null => {
  if (input.length === 5 && input[2] === ':') {
    try {
      const hours = parseInt(input.slice(0, 2));
      const minutes = parseInt(input.slice(3, 5));
      const result = hours * 3600 + minutes * 60;
      if (result < 0 || result >= 86400) {
        return null;
      }
      return result;
    } catch (e) {
      return null;
    }
  }

  return null;
};
