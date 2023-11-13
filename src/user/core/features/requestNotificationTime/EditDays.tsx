import { ReactElement, useCallback } from 'react';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import styles from './EditDays.module.css';
import { DayOfWeek } from './RequestNotificationTimeResources';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { Checkbox } from '../../../../shared/forms/Checkbox';
import { Button } from '../../../../shared/forms/Button';

export type EditDaysProps = {
  /**
   * The days that are currently selected. If the user changes the days,
   * this value will be updated.
   */
  days: WritableValueWithCallbacks<Set<DayOfWeek>>;

  /**
   * If the form should be disabled or not.
   */
  disabled: ValueWithCallbacks<boolean>;

  /**
   * Called when the user clicks the continue button.
   */
  onContinue: ValueWithCallbacks<() => void>;
};

const daysOfWeek: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Renders a form to edit a set of days of the week. This is expected to be
 * within a modal, i.e., the page contains a larger form that contains a set of
 * days, and if the user wants to edit the days they can tap the days to open a
 * modal containing this form. Hence, this renders a continue button and assumes
 * that it is instant and can't fail.
 */
export const EditDays = ({ days, disabled, onContinue }: EditDaysProps): ReactElement => {
  const checkedVWC = useMappedValueWithCallbacks(
    days,
    useCallback((daysV) => {
      const res = new Array<boolean>(daysOfWeek.length);
      for (let i = 0; i < res.length; i++) {
        res[i] = daysV.has(daysOfWeek[i]);
      }
      return res;
    }, []),
    {
      outputEqualityFn(a, b) {
        return a.length === b.length && a.every((v, i) => v === b[i]);
      },
    }
  );

  const onFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (disabled.get()) {
        return;
      }

      const checked = checkedVWC.get();
      const newDays = new Set<DayOfWeek>();
      for (let i = 0; i < checked.length; i++) {
        if (checked[i]) {
          newDays.add(daysOfWeek[i]);
        }
      }
      setVWC(days, newDays);

      onContinue.get()();
    },
    [checkedVWC, onContinue, disabled, days]
  );

  return (
    <form className={styles.form} onSubmit={onFormSubmit}>
      <div className={styles.formItems}>
        <RenderGuardedComponent
          props={checkedVWC}
          component={(checked) => (
            <>
              {checked.map((c, i) => (
                <div className={styles.formItem} key={i}>
                  <Checkbox
                    checkboxStyle="whiteWide"
                    label={daysOfWeek[i]}
                    value={c}
                    setValue={(v) => {
                      const oldDays = days.get();
                      const newDays = new Set(oldDays);
                      if (v) {
                        newDays.add(daysOfWeek[i]);
                      } else {
                        newDays.delete(daysOfWeek[i]);
                      }
                      setVWC(days, newDays);
                    }}
                  />
                </div>
              ))}
            </>
          )}
        />
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
  );
};
