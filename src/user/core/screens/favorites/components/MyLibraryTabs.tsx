import { PropsWithChildren, ReactElement } from 'react';
import styles from './MyLibraryTabs.module.css';
import { HorizontalSpacer } from '../../../../../shared/components/HorizontalSpacer';
import {
  ValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../../../shared/hooks/useMappedValueWithCallbacks';
import { useStyleVWC } from '../../../../../shared/hooks/useStyleVWC';
import { setVWC } from '../../../../../shared/lib/setVWC';

/**
 * Allows the user to click between the given tabs in the My Library screen
 * (which is really a collection of 3 screens)
 */
export const MyLibraryTabs = ({
  active,
  contentWidth: contentWidthVWC,
  onFavorites,
  onHistory,
  onOwned,
}: {
  active: 'favorites' | 'history' | 'owned';
  contentWidth: ValueWithCallbacks<number>;
  onFavorites?: () => void;
  onHistory?: () => void;
  onOwned?: () => void;
}): ReactElement => {
  const containerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const containerStyleVWC = useMappedValueWithCallbacks(contentWidthVWC, (width) => ({
    width: `${width}px`,
    maxWidth: `${width}px`,
  }));
  useStyleVWC(containerRef, containerStyleVWC);

  return (
    <div
      className={styles.container}
      style={containerStyleVWC.get()}
      ref={(r) => setVWC(containerRef, r)}>
      <Btn onClick={onFavorites} active={active === 'favorites'}>
        Favorites
      </Btn>
      <HorizontalSpacer width={24} />
      <Btn onClick={onHistory} active={active === 'history'}>
        History
      </Btn>
      <HorizontalSpacer width={24} />
      <Btn onClick={onOwned} active={active === 'owned'}>
        Owned
      </Btn>
    </div>
  );
};

const Btn = ({
  onClick,
  active,
  children,
}: PropsWithChildren<{
  onClick?: () => void;
  active: boolean;
}>): ReactElement => {
  if (onClick === undefined) {
    return <div className={active ? styles.active : styles.inactive}>{children}</div>;
  }

  return (
    <button
      className={active ? styles.active : styles.inactive}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}>
      {children}
    </button>
  );
};
