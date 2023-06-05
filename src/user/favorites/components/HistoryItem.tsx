import { ReactElement, useCallback, useContext, useState } from 'react';
import { OsehImage } from '../../../shared/OsehImage';
import { IconButton } from '../../../shared/forms/IconButton';
import { MinimalJourney } from '../lib/MinimalJourney';
import styles from './HistoryItem.module.css';
import { ErrorBlock, describeError } from '../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/LoginContext';

type HistoryItemProps = {
  /**
   * The item to render
   */
  item: MinimalJourney;

  /**
   * If the user modifies the item, i.e., by favoriting/unfavoriting it,
   * the callback to update the item. This is called after the change is
   * already stored serverside.
   *
   * @param item The new item
   */
  setItem: (item: MinimalJourney) => void;
};

/**
 * Renders a minimal journey for the favorites or history tab.
 */
export const HistoryItem = ({ item, setItem }: HistoryItemProps) => {
  const loginContext = useContext(LoginContext);
  const [error, setError] = useState<ReactElement | null>(null);
  const [liking, setLiking] = useState(false);

  const onLike = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      setLiking(true);
      setError(null);
      try {
        const response = await apiFetch(
          '/api/1/users/me/journeys/likes',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              journey_uid: item.uid,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }

        setItem({
          ...item,
          likedAt: new Date(),
        });
      } catch (e) {
        const err = await describeError(e);
        setError(err);
      } finally {
        setLiking(false);
      }
    },
    [item, loginContext, setItem]
  );

  const onUnlike = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      setLiking(true);
      setError(null);
      try {
        const response = await apiFetch(
          '/api/1/users/me/journeys/likes?uid=' + encodeURIComponent(item.uid),
          {
            method: 'DELETE',
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }

        setItem({
          ...item,
          likedAt: null,
        });
      } catch (e) {
        const err = await describeError(e);
        setError(err);
      } finally {
        setLiking(false);
      }
    },
    [item, loginContext, setItem]
  );

  return (
    <div className={styles.container}>
      <div className={styles.titleAndInstructor}>
        <div className={styles.title}>{item.title}</div>
        <div className={styles.instructor}>
          <div className={styles.instructorPictureContainer}>
            <OsehImage
              uid={item.instructor.image.uid}
              jwt={item.instructor.image.jwt}
              displayWidth={14}
              displayHeight={14}
              alt="headshot"
              isPublic={item.instructor.image.jwt === null}
            />
          </div>
          <div className={styles.instructorName}>{item.instructor.name}</div>
        </div>
      </div>
      <div className={styles.favoritedContainer}>
        <IconButton
          icon={item.likedAt === null ? styles.unfavoritedIcon : styles.favoritedIcon}
          srOnlyName={item.likedAt === null ? 'Like' : 'Unlike'}
          onClick={item.likedAt === null ? onLike : onUnlike}
          disabled={liking}
        />
      </div>
      {error && <ErrorBlock>{error}</ErrorBlock>}
    </div>
  );
};
