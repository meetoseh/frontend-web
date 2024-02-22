import { ReactElement } from 'react';
import styles from './BottomNavBar.module.css';
import { combineClasses } from '../../shared/lib/combineClasses';

export type BottomNavItem = 'home' | 'series' | 'account';

type ItemInfo = {
  readonly item: BottomNavItem;
  readonly iconClass: string;
  readonly label: string;
};

const items: readonly ItemInfo[] = [
  {
    item: 'home',
    iconClass: styles.iconHome,
    label: 'Home',
  },
  {
    item: 'series',
    iconClass: styles.iconSeries,
    label: 'Series',
  },
  {
    item: 'account',
    iconClass: styles.iconAccount,
    label: 'Account',
  },
] as const;

export type BottomNavBarProps = {
  active: BottomNavItem | null;

  clickHandlers: {
    [K in BottomNavItem]?: () => void;
  };
};

/**
 * Renders the standard bottom nav bar. This is rendered where it is
 * on the DOM and hence usually needs to have its position considered
 * by the outer component.
 */
export const BottomNavBar = ({ active, clickHandlers }: BottomNavBarProps): ReactElement => {
  return (
    <div className={styles.container}>
      {items.map((item) => (
        <BottomNavItem
          key={item.item}
          active={active === item.item}
          item={item}
          handler={clickHandlers[item.item]}
        />
      ))}
    </div>
  );
};

const BottomNavItem = ({
  active,
  item,
  handler,
}: {
  active: boolean;
  item: ItemInfo;
  handler: (() => void) | undefined;
}): ReactElement => {
  return (
    <div
      className={combineClasses(styles.itemWrapper, active ? styles.itemWrapperActive : undefined)}>
      <button
        type="button"
        className={styles.item}
        onClick={(e) => {
          e.preventDefault();
          handler?.();
        }}>
        <div className={styles.iconWrapper}>
          <div className={combineClasses(styles.icon, item.iconClass)} />
        </div>
        <div className={styles.label}>{item.label}</div>
      </button>
    </div>
  );
};
