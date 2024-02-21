import { ReactElement } from 'react';
import { ValueWithCallbacks } from '../../shared/lib/Callbacks';
import { useUnwrappedValueWithCallbacks } from '../../shared/hooks/useUnwrappedValueWithCallbacks';

export type CrudSwappableElementProps = {
  version: ValueWithCallbacks<boolean>;
  truthy: () => ReactElement;
  falsey: () => ReactElement;
  /** If true, apply changes via setState immediately. See RenderGuardedComponent for details */
  applyInstantly?: boolean;
};

/**
 * Convenience component for showing the truthy or falsey component based on the
 * unwrapped value of version
 */
export const CrudSwappableElement = ({
  version,
  truthy,
  falsey,
  applyInstantly,
}: CrudSwappableElementProps): ReactElement => {
  const versionRaw = useUnwrappedValueWithCallbacks(version, undefined, applyInstantly);
  return versionRaw ? truthy() : falsey();
};
