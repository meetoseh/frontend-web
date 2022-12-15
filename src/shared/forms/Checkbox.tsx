import { ReactElement } from 'react';
import styles from './Checkbox.module.css';

type CheckboxProps = {
  /**
   * The current value of the checkbox
   */
  value: boolean;

  /**
   * Used to set the value of the checkbox
   */
  setValue: (value: boolean) => void;

  /**
   * The label to display next to the checkbox
   */
  label: string;

  /**
   * Whether the checkbox is disabled
   * @default false
   */
  disabled?: boolean;
};

/**
 * A checkbox with a label
 */
export const Checkbox = ({
  value,
  setValue,
  label,
  disabled = false,
}: CheckboxProps): ReactElement => {
  return (
    <div
      className={`${styles.container} ${disabled ? styles.disabled : styles.enabled}`}
      onClick={(e) => {
        if (e.target instanceof HTMLInputElement) {
          return;
        }

        e.preventDefault();
        if (!disabled) {
          setValue(!value);
        }
      }}>
      <input
        className={styles.input}
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.checked);
        }}
      />
      <label className={styles.label}>{label}</label>
    </div>
  );
};
