import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { OsehImageStatesRef, useOsehImageStatesRef } from '../../../shared/OsehImage';
import { IconButton } from '../../../shared/forms/IconButton';
import { MinimalJourney } from '../lib/MinimalJourney';
import styles from './HistoryItem.module.css';
import { ErrorBlock, describeError } from '../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/LoginContext';
import { useFavoritedModal } from '../hooks/useFavoritedModal';
import { useUnfavoritedModal } from '../hooks/useUnfavoritedModal';
import { OsehImageState } from '../../../shared/OsehImage';
import { OsehImageFromState } from '../../../shared/OsehImage';
import { waitUntilNextImageStateUpdateCancelable } from '../../../shared/OsehImage';
import { Callbacks } from '../../../shared/lib/Callbacks';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { createCancelableTimeout } from '../../../shared/lib/createCancelableTimeout';
import { textOverflowEllipses } from '../../../shared/lib/calculateKerningLength';

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
   * If specified, used for fetching the instructor images at a fixed size.
   * This can implement caching for better performance.
   */
  instructorImages?: OsehImageStatesRef;
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
  const fallbackInstructorImages = useOsehImageStatesRef({});
  const [instructorImage, setInstructorImage] = useState<{
    uid: string;
    state: OsehImageState;
  } | null>(null);

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

  useEffect(() => {
    if (instructorImage !== null && instructorImage.uid === item.instructor.image.uid) {
      return;
    }

    const images = instructorImages ?? fallbackInstructorImages;

    let active = true;
    const cancelers = new Callbacks<undefined>();
    getImage();
    return () => {
      if (active) {
        active = false;
        cancelers.call(undefined);

        const oldProps = images.handling.current.get(item.instructor.image.uid);
        if (oldProps !== undefined) {
          images.handling.current.delete(item.instructor.image.uid);
          images.onHandlingChanged.current.call({
            uid: item.instructor.image.uid,
            old: oldProps,
            current: null,
          });
        }
      }
    };

    function ensureLoading() {
      if (images.handling.current.has(item.instructor.image.uid)) {
        return;
      }

      const props = {
        uid: item.instructor.image.uid,
        jwt: item.instructor.image.jwt,
        displayWidth: 14,
        displayHeight: 14,
        alt: 'headshot',
        isPublic: item.instructor.image.jwt === null,
      };
      images.handling.current.set(item.instructor.image.uid, props);
      images.onHandlingChanged.current.call({
        uid: item.instructor.image.uid,
        old: null,
        current: props,
      });
    }

    async function getImage() {
      while (true) {
        const image = images.state.current.get(item.instructor.image.uid);
        if (image !== undefined && !image.loading) {
          setInstructorImage({ uid: item.instructor.image.uid, state: image });
          return;
        }

        let loadCallback = waitUntilNextImageStateUpdateCancelable(images);
        let cancelCallback = createCancelablePromiseFromCallbacks(cancelers);
        let timeoutCallback = createCancelableTimeout(1000);
        cancelCallback.promise.catch(() => {});
        timeoutCallback.promise.catch(() => {});
        ensureLoading();
        await Promise.race([loadCallback.promise, cancelCallback.promise, timeoutCallback.promise]);
        if (!active) {
          loadCallback.cancel();
          timeoutCallback.cancel();
          return;
        }

        if (timeoutCallback.done()) {
          loadCallback.cancel();
          cancelCallback.cancel();
          continue;
        }

        cancelCallback.cancel();
      }
    }
  }, [item.instructor.image, instructorImages, fallbackInstructorImages, instructorImage]);

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
              {instructorImage && <OsehImageFromState {...instructorImage.state} />}
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
