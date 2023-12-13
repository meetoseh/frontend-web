import { ReactElement } from 'react';
import { combineClasses } from '../../shared/lib/combineClasses';
import styles from './AdminDashboardTopBlock.module.css';

type AdminDashboardTopBlockProps = {
  /**
   * The class to apply to the element which should act as the
   * icon for this number, e.g., a silhouette for total members
   */
  iconClassName: string;

  /**
   * The value to display, as an integer
   */
  value: number;

  /**
   * The label to display, e.g., "Total Members"
   */
  label: string;

  /**
   * If specified, added as additional classes to the relevant components. In order to
   * ensure you are more specific than the default styles, you should use the
   * `!important` CSS rule.
   */
  styles?: {
    container?: string;
    innerContainer?: string;
    iconContainer?: string;
    icon?: string;
    valueAndLabelContainer?: string;
    value?: string;
    label?: string;
  };
};

export const AdminDashboardTopBlock = ({
  iconClassName,
  value,
  label,
  styles: extraStyles,
}: AdminDashboardTopBlockProps): ReactElement => {
  return (
    <div className={combineClasses(styles.container, extraStyles?.container)}>
      <div className={combineClasses(styles.innerContainer, extraStyles?.innerContainer)}>
        <div className={combineClasses(styles.iconContainer, extraStyles?.iconContainer)}>
          <div className={combineClasses(iconClassName, extraStyles?.icon)}></div>
        </div>

        <div
          className={combineClasses(
            styles.valueAndLabelContainer,
            extraStyles?.valueAndLabelContainer
          )}>
          <div className={combineClasses(styles.value, extraStyles?.value)}>
            {value.toLocaleString()}
          </div>
          <div className={combineClasses(styles.label, extraStyles?.label)}>{label}</div>
        </div>
      </div>
    </div>
  );
};
