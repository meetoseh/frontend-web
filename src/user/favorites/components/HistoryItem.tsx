import { ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { IconButton } from '../../../shared/forms/IconButton';
import { MinimalJourney } from '../lib/MinimalJourney';
import styles from './HistoryItem.module.css';
import { ErrorBlock, describeError } from '../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/LoginContext';
import { useFavoritedModal } from '../hooks/useFavoritedModal';
import { useUnfavoritedModal } from '../hooks/useUnfavoritedModal';
import { textOverflowEllipses } from '../../../shared/lib/calculateKerningLength';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageState } from '../../../shared/images/useOsehImageState';
import { OsehImageFromState } from '../../../shared/images/OsehImageFromState';

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

  /**
   * If true, a separator indicating the date the item was taken is rendered
   * just before the item.
   */
  separator?: boolean;

  /**
   * Called if the user clicks the item outside of the normally clickable
   * areas.
   */
  onClick?: () => void;

  /**
   * The request handler to use for instructor images
   */
  instructorImages: OsehImageStateRequestHandler;
};

/**
 * Renders a minimal journey for the favorites or history tab.
 */
export const HistoryItem = ({
  item,
  setItem,
  separator,
  onClick,
  instructorImages,
}: HistoryItemProps) => {
  const loginContext = useContext(LoginContext);
  const [error, setError] = useState<ReactElement | null>(null);
  const [liking, setLiking] = useState(false);
  const [showLikedUntil, setShowLikedUntil] = useState<number | undefined>(undefined);
  const [showUnlikedUntil, setShowUnlikedUntil] = useState<number | undefined>(undefined);
  const instructorImage = useOsehImageState(
    {
      ...item.instructor.image,
      displayWidth: 14,
      displayHeight: 14,
      alt: 'profile',
    },
    instructorImages
  );
  const onLike = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      setLiking(true);
      setError(null);
      setShowLikedUntil(undefined);
      setShowUnlikedUntil(undefined);
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
        setShowLikedUntil(Date.now() + 5000);
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
      e.stopPropagation();

      setLiking(true);
      setError(null);
      setShowLikedUntil(undefined);
      setShowUnlikedUntil(undefined);
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
        setShowUnlikedUntil(Date.now() + 5000);
      } catch (e) {
        const err = await describeError(e);
        setError(err);
      } finally {
        setLiking(false);
      }
    },
    [item, loginContext, setItem]
  );

  useFavoritedModal(showLikedUntil);
  useUnfavoritedModal(showUnlikedUntil);

  const ellipsedTitle = useMemo(() => textOverflowEllipses(item.title, 15), [item.title]);

  return (
    <div onClick={onClick}>
      {separator && item.lastTakenAt !== null && (
        <div className={styles.separator}>{item.lastTakenAt.toLocaleDateString()}</div>
      )}
      <div className={styles.container}>
        <div className={styles.titleAndInstructor}>
          <div className={styles.title}>{ellipsedTitle}</div>
          <div className={styles.instructor}>
            <div className={styles.instructorPictureContainer}>
              <OsehImageFromState {...instructorImage} />
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
    </div>
  );
};
