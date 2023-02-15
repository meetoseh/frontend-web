import { ReactElement, useMemo } from 'react';
import { OsehImage, OsehImageRef } from '../../../shared/OsehImage';
import { ProfilePictures } from '../hooks/useProfilePictures';
import '../../../assets/fonts.css';
import styles from './JourneyProfilePictures.module.css';

type JourneyProfilePicturesProps = {
  /**
   * The pictures to show
   */
  pictures: ProfilePictures;

  /**
   * The total number of users in the journey
   */
  users: number;
};

/**
 * Shows a sample of profile pictures for users in the journey, followed
 * by the +X text for how many more users are in the journey (if there
 * are more than those shown)
 */
export const JourneyProfilePictures = ({
  pictures,
  users,
}: JourneyProfilePicturesProps): ReactElement => {
  const bonusUsers = users - pictures.pictures.length;
  const usedPictures = useMemo(() => {
    const seen = new Set<string>();
    const used: OsehImageRef[] = [];
    for (const picture of pictures.pictures) {
      if (!seen.has(picture.uid)) {
        used.push(picture);
        seen.add(picture.uid);
      }
    }
    return used;
  }, [pictures.pictures]);

  return (
    <div className={styles.container}>
      <div className={styles.picturesContainer}>
        {usedPictures.map((picture) => (
          <div className={styles.pictureContainer} key={picture.uid}>
            <OsehImage
              uid={picture.uid}
              jwt={picture.jwt}
              displayWidth={38}
              displayHeight={38}
              alt=""
            />
          </div>
        ))}
      </div>
      {bonusUsers > 0 && (
        <div className={styles.bonusUsersContainer}>
          <div className={styles.bonusUsersText}>
            {bonusUsers.toLocaleString(undefined, { signDisplay: 'always' })}
          </div>
        </div>
      )}
    </div>
  );
};