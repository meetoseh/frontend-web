import { ReactElement } from 'react';
import { User } from './User';
import styles from './UserBlock.module.css';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { OsehImage } from '../../shared/OsehImage';
import { IconButton } from '../../shared/forms/IconButton';

type UserBlockProps = {
  user: User;
  setUser: (user: User) => void;
};

export const UserBlock = ({ user }: UserBlockProps): ReactElement => {
  return (
    <CrudItemBlock
      title={user.email}
      controls={
        <>
          <IconButton
            icon={styles.iconExpand}
            onClick={`/admin/user?sub=${encodeURIComponent(user.sub)}`}
            srOnlyName="Expand"
          />
        </>
      }>
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
          {user.givenName} {user.familyName} (pn: {user.phoneNumber ?? 'Not Set'})
        </div>
      </div>
    </CrudItemBlock>
  );
};
