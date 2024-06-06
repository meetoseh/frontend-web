import { ReactElement, useContext } from 'react';
import { UserClientScreenLog } from './UserClientScreenLog';
import styles from './UserClientScreen.module.css';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { showUserClientScreenActions } from './showUserClientScreenActions';
import { ModalContext } from '../../../../shared/contexts/ModalContext';
import { User } from '../../User';

export const UserClientScreen = ({
  user,
  item,
}: {
  user: User;
  item: UserClientScreenLog;
}): ReactElement => {
  const modalContext = useContext(ModalContext);
  return (
    <button
      type="button"
      className={styles.container}
      onClick={(e) => {
        e.preventDefault();
        showUserClientScreenActions(modalContext.modals, { user, screen: item });
      }}>
      <div className={styles.screenSlug}>{item.screen.slug}</div>
      <VerticalSpacer height={4} />
      <div className={styles.createdAt}>{item.createdAt.toLocaleString()}</div>
    </button>
  );
};
