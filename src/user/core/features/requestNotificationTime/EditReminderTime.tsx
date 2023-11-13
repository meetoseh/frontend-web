import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { EditTimeRange, TimeRange, areRangesEqual } from './EditTimeRange';
import { DayOfWeek } from './RequestNotificationTimeResources';
import styles from './EditReminderTime.module.css';
import { ReactElement, useCallback, useContext, useRef } from 'react';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import {
  ModalContext,
  addModalWithCallbackToRemove,
} from '../../../../shared/contexts/ModalContext';
import { setVWC } from '../../../../shared/lib/setVWC';
import { SlideInModal } from '../../../../shared/components/SlideInModal';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { EditDays } from './EditDays';
import { makeDaysOfWeekPretty, makeTimeRangePretty, nameForChannel } from './formatUtils';
import { Channel } from './RequestNotificationTimeState';

export type EditReminderTimeProps = {
  /**
   * Used to report the current time range selection. This component fully
   * supports external writes. If the user is currently editing the time range
   * then writing to this will trigger an undesirable rerender, so this should
   * be only be modified due to some other user input.
   */
  timeRange: WritableValueWithCallbacks<TimeRange>;

  /**
   * Used to report the current days selection. This component
   * fully supports external writes. If the user is currently editing
   * the time range this will trigger an undesirable rerender, so this
   * should be only be modified due to some other user input.
   */
  days: WritableValueWithCallbacks<Set<DayOfWeek>>;

  /**
   * The channel that the user is currently editing, to provide additional
   * context.
   */
  channel?: ValueWithCallbacks<Channel>;

  /**
   * If specified, invoked when the user begins to modify the time range.
   */
  onOpenTimeRange?: () => void;

  /**
   * If specified, invoked when the user finishes modifying the time range.
   * Called just after writing to the time range.
   */
  onClosedTimeRange?: (newValue: TimeRange) => void;

  /**
   * If specified, invoked when the user begins to modify the days.
   */
  onOpenDays?: () => void;

  /**
   * If specified, invoked when the user finishes modifying the days.
   * Called just after writing to the days.
   */
  onClosedDays?: (newValue: Set<DayOfWeek>) => void;
};

function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  const iter = a.values();
  let next = iter.next();
  while (!next.done) {
    if (!b.has(next.value)) {
      return false;
    }
    next = iter.next();
  }

  return true;
}

/**
 * Shows a simple section with a section header and then two
 * subcomponents, one for showing the time range and one for
 * showing the days. The user can tap either of these to open
 * a modal for editing them.
 *
 * Requires a modal context.
 */
export const EditReminderTime = ({
  timeRange,
  days,
  channel,
  onOpenTimeRange,
  onClosedTimeRange,
  onOpenDays,
  onClosedDays,
}: EditReminderTimeProps): ReactElement => {
  const modalContext = useContext(ModalContext);
  const editingTimeRange = useWritableValueWithCallbacks(() => false);
  const editingDays = useWritableValueWithCallbacks(() => false);

  const onOpenTimeRangeRef = useRef(onOpenTimeRange);
  onOpenTimeRangeRef.current = onOpenTimeRange;

  const onClosedTimeRangeRef = useRef(onClosedTimeRange);
  onClosedTimeRangeRef.current = onClosedTimeRange;

  const onOpenDaysRef = useRef(onOpenDays);
  onOpenDaysRef.current = onOpenDays;

  const onClosedDaysRef = useRef(onClosedDays);
  onClosedDaysRef.current = onClosedDays;

  useValueWithCallbacksEffect(
    editingTimeRange,
    useCallback(
      (visible) => {
        if (!visible) {
          return undefined;
        }

        const cancelers = new Callbacks<undefined>();
        const guardedTimeRange = createWritableValueWithCallbacks<TimeRange>(timeRange.get());
        const disabled = createWritableValueWithCallbacks<boolean>(true);
        const requestClose = createWritableValueWithCallbacks<() => void>(() => {});
        const inputKey = createWritableValueWithCallbacks<number>(0);

        let reportedClose = false;
        const reportClose = () => {
          if (reportedClose) {
            return;
          }

          reportedClose = true;
          timeRange.callbacks.remove(timeRangeCallback);
          setVWC(timeRange, guardedTimeRange.get(), areRangesEqual);
          onClosedTimeRangeRef.current?.(guardedTimeRange.get());
        };

        const timeRangeCallback = () => {
          setVWC(guardedTimeRange, timeRange.get(), areRangesEqual);
          setVWC(inputKey, inputKey.get() + 1);
        };
        timeRange.callbacks.add(timeRangeCallback);
        cancelers.add(() => {
          timeRange.callbacks.remove(timeRangeCallback);
        });

        cancelers.add(
          addModalWithCallbackToRemove(
            modalContext.modals,
            <SlideInModal
              title="Time"
              onClosing={() => {
                reportClose();
              }}
              onClosed={() => {
                reportClose();
                setVWC(editingTimeRange, false);
              }}
              requestClose={requestClose}
              animating={disabled}>
              <RenderGuardedComponent
                props={inputKey}
                component={(key) => (
                  <EditTimeRange
                    key={key}
                    timeRange={guardedTimeRange}
                    disabled={disabled}
                    onContinue={requestClose}
                  />
                )}
              />
            </SlideInModal>
          )
        );

        return () => {
          cancelers.call(undefined);
          cancelers.clear();
        };
      },
      [editingTimeRange, timeRange, modalContext.modals]
    )
  );

  useValueWithCallbacksEffect(
    editingDays,
    useCallback(
      (visible) => {
        if (!visible) {
          return undefined;
        }

        const cancelers = new Callbacks<undefined>();
        const guardedDays = createWritableValueWithCallbacks<Set<DayOfWeek>>(days.get());
        const disabled = createWritableValueWithCallbacks<boolean>(true);
        const requestClose = createWritableValueWithCallbacks<() => void>(() => {});
        const inputKey = createWritableValueWithCallbacks<number>(0);

        let reportedClose = false;
        const reportClose = () => {
          if (reportedClose) {
            return;
          }

          reportedClose = true;
          days.callbacks.remove(daysCallback);
          setVWC(days, guardedDays.get(), areSetsEqual);
          onClosedDaysRef.current?.(guardedDays.get());
        };

        const daysCallback = () => {
          setVWC(guardedDays, days.get(), areSetsEqual);
          setVWC(inputKey, inputKey.get() + 1);
        };
        days.callbacks.add(daysCallback);
        cancelers.add(() => {
          days.callbacks.remove(daysCallback);
        });

        cancelers.add(
          addModalWithCallbackToRemove(
            modalContext.modals,
            <SlideInModal
              title="Repeat"
              onClosed={() => {
                reportClose();
                setVWC(editingDays, false);
              }}
              onClosing={() => {
                reportClose();
              }}
              requestClose={requestClose}
              animating={disabled}>
              <RenderGuardedComponent
                props={inputKey}
                component={(key) => (
                  <EditDays
                    key={key}
                    days={guardedDays}
                    disabled={disabled}
                    onContinue={requestClose}
                  />
                )}
              />
            </SlideInModal>
          )
        );

        return () => {
          cancelers.call(undefined);
          cancelers.clear();
        };
      },
      [editingDays, days, modalContext.modals]
    )
  );

  return (
    <div className={styles.container}>
      <div className={styles.title}>We&rsquo;ll remind you:</div>
      <div className={styles.options}>
        <button
          type="button"
          className={styles.option}
          onClick={(e) => {
            e.preventDefault();
            onOpenTimeRangeRef.current?.();
            setVWC(editingTimeRange, true);
          }}>
          <span>
            <RenderGuardedComponent
              props={timeRange}
              component={(range) => (
                <>
                  {range.start !== range.end ? <>Between</> : <>At</>}{' '}
                  <strong>{makeTimeRangePretty(range.start, range.end)}</strong>
                </>
              )}
            />
          </span>
        </button>
        <button
          type="button"
          className={styles.option}
          onClick={(e) => {
            e.preventDefault();
            onOpenDaysRef.current?.();
            setVWC(editingDays, true);
          }}>
          <span>
            Repeat{' '}
            <RenderGuardedComponent
              props={days}
              component={(days) => (
                <strong>
                  {makeDaysOfWeekPretty(Array.from(days))}
                  {days.size === 0 && (
                    <>
                      {' '}
                      (No
                      {channel && (
                        <RenderGuardedComponent
                          props={channel}
                          component={(ch) => <> {nameForChannel(ch)}</>}
                        />
                      )}{' '}
                      reminders)
                    </>
                  )}
                </strong>
              )}
            />
          </span>
        </button>
      </div>
    </div>
  );
};
