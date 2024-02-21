import { ReactElement, useEffect, useRef, useState } from 'react';
import styles from './TextInput.module.css';

type TextInputProps = {
  /**
   * The label for the text input, which also acts as its
   * placeholder.
   */
  label: string;

  /**
   * The current value of the text input
   */
  value: string;

  /**
   * Supporting text, if any
   */
  help: string | null;

  /**
   * Disables the input and fades it out
   */
  disabled: boolean;

  /**
   * Ignored when disabled - configures the style of the input
   */
  inputStyle: 'white' | 'normal' | 'success' | 'error' | 'error-white' | 'success-white';

  /**
   * Called when the value of the input changes
   */
  onChange: (this: void, value: string) => void;

  /**
   * Any additional props for html5 validation, such as min, max, required, etc.
   */
  html5Validation: React.InputHTMLAttributes<HTMLInputElement> | null;

  /**
   * The type of input. Generally only text-like inputs will work, like number,
   * though there are often better components for anything except text or email.
   *
   * @default 'text'
   */
  type?: string;

  /**
   * If specified, called with a function that can be used to focus the input
   */
  doFocus?: ((focuser: (this: void) => void) => void) | null;

  /**
   * If true, the number spinner will be hidden for number inputs
   * @default false
   */
  hideNumberSpinner?: boolean;
};

/**
 * Describes a managed text input with a floating label and an error variant.
 */
export const TextInput = ({
  label,
  value,
  help,
  disabled,
  inputStyle,
  onChange,
  html5Validation,
  type = 'text',
  doFocus = null,
  hideNumberSpinner = false,
}: TextInputProps): ReactElement => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current === null || doFocus === null) {
      return;
    }

    const input = inputRef.current;
    doFocus(() => {
      input.focus();
    });
  }, [doFocus]);

  useEffect(() => {
    if (inputRef.current === null) {
      return;
    }

    const input = inputRef.current;

    const focusListener = () => setFocused(true);
    const blurListener = () => setFocused(false);

    input.addEventListener('focus', focusListener);
    input.addEventListener('blur', blurListener);

    return () => {
      input.removeEventListener('focus', focusListener);
      input.removeEventListener('blur', blurListener);
    };
  }, []);

  useEffect(() => {
    if (inputRef.current === null || labelRef.current === null) {
      return;
    }

    const input = inputRef.current;
    const label = labelRef.current;

    const onClick = () => input.focus();

    label.addEventListener('click', onClick);

    return () => {
      label.removeEventListener('click', onClick);
    };
  });

  return (
    <div
      className={`${styles.container} ${styles[inputStyle]} ${
        value === '' && !focused ? styles.empty : styles.filledOrFocused
      } ${disabled ? styles.disabled : ''} ${hideNumberSpinner ? styles.hideNumberSpinner : ''}`}>
      <div className={styles.labelAndInput}>
        <div ref={labelRef} className={styles.label}>
          {label}
        </div>
        <div className={styles.inputContainer}>
          <input
            ref={inputRef}
            className={styles.input}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            {...html5Validation}
          />
        </div>
      </div>
      {help && <div className={styles.help}>{help}</div>}
    </div>
  );
};
