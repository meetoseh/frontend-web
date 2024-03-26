import { ReactElement } from 'react';
import { WritableValueWithTypedCallbacks, downgradeTypedVWC } from '../lib/Callbacks';
import styles from './SurveyCheckboxGroup.module.css';
import { Checkbox } from '../forms/Checkbox';
import { RenderGuardedComponent } from './RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';

/**
 * A presentable option within a survey checkbox group
 */
export type SurveyCheckboxGroupChoice<T extends string> = {
  /** The identifier for the option */
  slug: T;
  /** The element containing the description of the option */
  element: ReactElement;
};

export type SurveyCheckboxGroupProps<T extends string> = {
  /** The options to present */
  choices: SurveyCheckboxGroupChoice<T>[] | readonly SurveyCheckboxGroupChoice<T>[];
  /** Used to store and update which choices are checked. */
  checked: WritableValueWithTypedCallbacks<
    T[],
    { action: 'checked' | 'unchecked'; changed: T } | undefined
  >;
  /**
   * The visual style for the checkbox. Typically, square implies multiple can be
   * checked, while round implies only one can be checked.
   */
  variant: 'square' | 'round';
  /**
   * False or undefined to prevent unchecking an option once checked,
   * true to allow unchecking.
   */
  uncheck?: boolean;
  /**
   * False or undefined to allow only one option to be checked at a time,
   * true to allow multiple options to be checked.
   */
  multiple?: boolean;
};

/**
 * Presents a list of options for the user to select from. The options are
 * presented either as checkboxes or radio buttons, and either only one or
 * multiple options can be selected, depending on the props.
 */
export const SurveyCheckboxGroup = <T extends string>({
  choices,
  checked,
  variant,
  uncheck,
  multiple,
}: SurveyCheckboxGroupProps<T>): ReactElement => {
  return (
    <div className={styles.container}>
      {choices.map(({ slug, element }) => (
        <div className={styles.item} key={slug}>
          <WrappedCheckbox
            checked={checked}
            slug={slug}
            variant={variant}
            uncheck={uncheck}
            multiple={multiple}
            label={element}
          />
        </div>
      ))}
    </div>
  );
};

const WrappedCheckbox = <T extends string>({
  checked,
  slug,
  variant,
  uncheck,
  multiple,
  label,
}: {
  checked: SurveyCheckboxGroupProps<T>['checked'];
  slug: T;
  variant: 'square' | 'round';
  uncheck?: boolean;
  multiple?: boolean;
  label: ReactElement;
}): ReactElement => {
  const isChecked = useMappedValueWithCallbacks(downgradeTypedVWC(checked), (checked) =>
    checked.includes(slug)
  );
  return (
    <RenderGuardedComponent
      props={isChecked}
      component={(isChecked) => (
        <Checkbox
          value={isChecked}
          setValue={(v) => {
            if (v === isChecked) {
              return;
            }

            if (isChecked && !uncheck) {
              return;
            }

            if (v && !multiple) {
              // isChecked is false (if 1)
              checked.set([slug]);
              checked.callbacks.call({ action: 'checked', changed: slug });
              return;
            }

            if (v) {
              // isChecked is false (if 1)
              // multiple is true (if 3)
              const newChecked = [...checked.get(), slug];
              checked.set(newChecked);
              checked.callbacks.call({ action: 'checked', changed: slug });
              return;
            }

            // v is false (if 4)
            // isChecked is true (if 1)
            // uncheck is true (if 2)
            const newChecked = checked.get().filter((c) => c !== slug);
            checked.set(newChecked);
            checked.callbacks.call({ action: 'unchecked', changed: slug });
          }}
          label={label}
          checkboxStyle={variant === 'square' ? 'whiteWide' : 'whiteWideRound'}
        />
      )}
    />
  );
};
