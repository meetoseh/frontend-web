import { ReactElement, useCallback } from 'react';
import { useWritableValueWithCallbacks } from '../lib/Callbacks';
import { setVWC } from '../lib/setVWC';
import { RenderGuardedComponent } from '../components/RenderGuardedComponent';
import { IconButton } from './IconButton';

type IconButtonWithAutoDisableProps = {
  /**
   * The class which, when applied to an element, renders the icon
   */
  icon: string;

  /**
   * The name for screen readers
   */
  srOnlyName: string;

  /**
   * The click handler. The event will have its default behavior prevented.
   */
  onClick: () => Promise<void>;

  /**
   * If true, the button will spin while in the disabled state. Good for
   * refresh buttons.
   */
  spinWhileDisabled?: boolean;
};

/**
 * An IconButton whose default button behavior is prevented, which only accepts
 * an onClick function handler which returns a promise, and which disables
 * itself while the promise is pending.
 */
export const IconButtonWithAutoDisable = ({
  icon,
  srOnlyName,
  onClick,
  spinWhileDisabled = false,
}: IconButtonWithAutoDisableProps): ReactElement => {
  const working = useWritableValueWithCallbacks(() => false);
  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (working.get()) {
        return;
      }
      setVWC(working, true);
      try {
        await onClick();
      } finally {
        setVWC(working, false);
      }
    },
    [working, onClick]
  );

  return (
    <RenderGuardedComponent
      props={working}
      component={(disabled) => (
        <IconButton
          icon={icon}
          srOnlyName={srOnlyName}
          onClick={handleClick}
          disabled={disabled}
          spinning={disabled && spinWhileDisabled}
        />
      )}
    />
  );
};
