import { ReactElement } from 'react';
import { User } from './User';
import styles from './UserBlock.module.css';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { OsehImage } from '../../shared/images/OsehImage';
import { IconButton } from '../../shared/forms/IconButton';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';

type UserBlockProps = {
  user: User;
  setUser: (user: User) => void;
  imageHandler: OsehImageStateRequestHandler;
};

export const UserBlock = ({ user, imageHandler }: UserBlockProps): ReactElement => {
  return (
    <CrudItemBlock
      title={user.emails[0]?.address || user.phones[0]?.number || user.sub}
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
              displayWidth={45}
              displayHeight={45}
              alt=""
              handler={imageHandler}
            />
          </div>
        )}
        <div className={styles.name}>
          {user.givenName} {user.familyName} (pn: {user.phones[0]?.number ?? 'Not Set'})
        </div>
      </div>
    </CrudItemBlock>
  );
};
