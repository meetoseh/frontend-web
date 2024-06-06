import { ReactElement } from 'react';
import { UserClientScreenActionLog } from './UserClientScreenActionLog';
import styles from './UserClientScreenAction.module.css';
import { CrudFormElement } from '../../../crud/CrudFormElement';

export const UserClientScreenAction = ({
  item,
}: {
  item: UserClientScreenActionLog;
}): ReactElement => {
  return (
    <div className={styles.container}>
      <CrudFormElement title="UID">{item.uid}</CrudFormElement>
      <CrudFormElement title="Event">
        <div className={styles.event}>{JSON.stringify(item.event, undefined, 2)}</div>
      </CrudFormElement>
      <CrudFormElement title="Occurred At">{item.createdAt.toLocaleString()}</CrudFormElement>
    </div>
  );
};
