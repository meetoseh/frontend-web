import { ReactElement } from 'react';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import { User } from '../User';
import styles from './BigUserBasicInfo.module.css';
import { OsehImage } from '../../../shared/images/OsehImage';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { TogglableSmoothExpandable } from '../../../shared/components/TogglableSmoothExpandable';

/**
 * A standard block that provides basic information on the user;
 * acts kind of like an extended version of the user block
 */
export const BigUserBasicInfo = ({
  user,
  imageHandler,
}: {
  user: User;
  imageHandler: OsehImageStateRequestHandler;
}): ReactElement => {
  return (
    <CrudItemBlock title="Basic Info" controls={null}>
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
          {user.givenName} {user.familyName}
        </div>
      </div>

      {user.emails.map((email) => (
        <CrudFormElement title="Email" key={email.address}>
          {email.address} ({!email.verified ? 'un' : ''}verified, {!email.suppressed ? 'un' : ''}
          suppressed, {!email.enabled ? 'dis' : 'en'}abled)
        </CrudFormElement>
      ))}
      {user.phones.map((phone) => (
        <CrudFormElement title="Phone Number" key={phone.number}>
          {phone.number} ({!phone.verified ? 'un' : ''}verified, {!phone.suppressed ? 'un' : ''}
          suppressed, {!phone.enabled ? 'dis' : 'en'}abled)
        </CrudFormElement>
      ))}
      <CrudFormElement title="Admin">{user.admin ? 'Yes' : 'No'}</CrudFormElement>
      {user.revenueCatIDs.map((rcid) => (
        <CrudFormElement key={rcid} title="Revenue Cat ID">
          {rcid}
        </CrudFormElement>
      ))}
      <CrudFormElement title="Gender">
        {user.gender === null ? (
          'Not checked'
        ) : (
          <div className={styles.gender}>
            <div className={styles.genderValue}>{user.gender.gender}</div>
            <TogglableSmoothExpandable>
              <code>
                <pre>{JSON.stringify(user.gender.source, undefined, 1)}</pre>
              </code>
            </TogglableSmoothExpandable>
          </div>
        )}
      </CrudFormElement>
      <CrudFormElement title="Created At">{user.createdAt.toLocaleString()}</CrudFormElement>
      <CrudFormElement title="Last Seen At">{user.lastSeenAt.toLocaleString()}</CrudFormElement>
    </CrudItemBlock>
  );
};
