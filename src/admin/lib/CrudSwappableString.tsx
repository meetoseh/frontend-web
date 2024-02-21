import { TextInput } from '../../shared/forms/TextInput';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { setVWC } from '../../shared/lib/setVWC';
import { CrudSwappableFormElement } from './CrudSwappableFormElement';

export type CrudSwappableStringProps = {
  /** True if we are in the editing version, false for the display version */
  editingVWC: ValueWithCallbacks<boolean>;
  /** The title for the form element */
  title: string;
  /** The value to display */
  vwc: WritableValueWithCallbacks<string>;
};

/**
 * Convenience component for rendering a string form element when not editing and
 * a TextInput when editing
 */
export function CrudSwappableString({ editingVWC, title, vwc }: CrudSwappableStringProps) {
  return (
    <CrudSwappableFormElement
      editingVWC={editingVWC}
      title={title}
      vwc={vwc}
      edit={() => (
        <TextInput
          label={title}
          value={vwc.get()}
          help={null}
          disabled={false}
          inputStyle="normal"
          onChange={(v) => setVWC(vwc, v)}
          html5Validation={null}
        />
      )}
      applyInstantly
    />
  );
}
