import { ReactElement } from 'react';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import { User } from '../User';
import styles from './BigUserBasicInfo.module.css';
import { OsehImage } from '../../../shared/OsehImage';
import { CrudFormElement } from '../../crud/CrudFormElement';

/**
 * A standard block that provides basic information on the user;
 * acts kind of like an extended version of the user block
 */
export const BigUserBasicInfo = ({ user }: { user: User }): ReactElement => {
  return (
    <CrudItemBlock title="Basic Info" controls={null}>
      <div className={styles.pictureAndName}>
        {user.profilePicture && (
          <div className={styles.profilePictureContainer}>
            <OsehImage
              uid={user.profilePicture.uid}
              jwt={user.profilePicture.jwt}
              displayWidth={60}
              displayHeight={60}
              alt=""
            />
          </div>
        )}
        <div className={styles.name}>
          {user.givenName} {user.familyName}
        </div>
      </div>

      <CrudFormElement title="Email">{user.email}</CrudFormElement>
      <CrudFormElement title="Phone Number">{user.phoneNumber ?? 'Not Set'}</CrudFormElement>
      <CrudFormElement title="Admin">{user.admin ? 'Yes' : 'No'}</CrudFormElement>
      <CrudFormElement title="Revenue Cat ID">{user.revenueCatID}</CrudFormElement>
      <CrudFormElement title="Created At">{user.createdAt.toLocaleString()}</CrudFormElement>
      <CrudFormElement title="Last Seen At">{user.lastSeenAt.toLocaleString()}</CrudFormElement>
    </CrudItemBlock>
  );
};
