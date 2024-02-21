import { ReactElement } from 'react';
import { ValueWithCallbacks } from '../../shared/lib/Callbacks';
import { CrudFormElement } from '../crud/CrudFormElement';
import { CrudSwappableElement } from './CrudSwappableElement';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';

export type CrudSwappableFormElementProps<T> = {
  /** True if we are in the editing version, false for the display version */
  editingVWC: ValueWithCallbacks<boolean>;
  /** The title for the form element */
  title: string;
  /** The current value to display */
  vwc: ValueWithCallbacks<T>;
  /** If specified, used instead of v.toString() */
  render?: (value: T) => ReactElement;
  /** Creates the editing component */
  edit: () => ReactElement;
  /** If true, apply changes via setState immediately. See RenderGuardedComponent for details */
  applyInstantly?: boolean;
};

/**
 * Convenience component for rendering a form element when not editing and
 * a custom component when editing
 */
export function CrudSwappableFormElement<T>({
  editingVWC,
  title,
  vwc,
  render,
  edit,
  applyInstantly,
}: CrudSwappableFormElementProps<T>): ReactElement {
  return (
    <CrudSwappableElement
      version={editingVWC}
      truthy={() => (
        <RenderGuardedComponent
          props={vwc}
          component={(v) => edit()}
          applyInstantly={applyInstantly}
        />
      )}
      falsey={() => (
        <CrudFormElement title={title}>
          <RenderGuardedComponent
            props={vwc}
            component={(v) => (render ? render(vwc.get()) : <>{`${vwc.get()}`}</>)}
            applyInstantly={applyInstantly}
          />
        </CrudFormElement>
      )}
    />
  );
}
