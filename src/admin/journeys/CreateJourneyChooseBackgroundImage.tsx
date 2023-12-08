import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Button } from '../../shared/forms/Button';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { OsehImage } from '../../shared/images/OsehImage';
import { CrudFetcher } from '../crud/CrudFetcher';
import { JourneyBackgroundImage } from './background_images/JourneyBackgroundImage';
import { keyMap as journeyBackgroundImageKeyMap } from './background_images/JourneyBackgroundImages';
import styles from './CreateJourneyChooseBackgroundImage.module.css';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';

type CreateJourneyChooseBackgroundImageProps = {
  /**
   * Called when the user selects which background image to use for the journey
   */
  onSelected: (this: void, image: JourneyBackgroundImage) => void;

  /**
   * The handler for fetching images
   */
  imageHandler: OsehImageStateRequestHandler;
};

const limit = 3;

export const CreateJourneyChooseBackgroundImage = ({
  onSelected,
  imageHandler,
}: CreateJourneyChooseBackgroundImageProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [items, setItems] = useState<JourneyBackgroundImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [haveMore, setHaveMore] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);

  const fetcher = useMemo(() => {
    return new CrudFetcher(
      '/api/1/journeys/background_images/search',
      journeyBackgroundImageKeyMap,
      setItems,
      setLoading,
      setHaveMore
    );
  }, []);

  const loadNext = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;

    setError(null);
    try {
      await fetcher.loadMore({}, limit, loginContext, { replace: true });
    } catch (e) {
      console.error(e);

      const err = await describeError(e);
      setError(err);
    }
  }, [fetcher, loginContextRaw]);

  const reset = useCallback(() => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;

    setError(null);
    fetcher.resetAndLoadWithCancelCallback(
      {},
      [{ key: 'last_uploaded_at', dir: 'desc', before: null, after: null }],
      limit,
      loginContext,
      async (e) => {
        console.error(e);
        const err = await describeError(e);
        setError(err);
      }
    );
  }, [fetcher, loginContextRaw]);

  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Choose Background Image</div>
        <div className={styles.help}>
          <p>
            Choose from recently uploaded background images below. The content is shown from most
            recently uploaded to least recently uploaded.
          </p>
          <p>
            It is usually easier to use the upload option to select a local file, as background
            images are automatically de-duplicated: re-uploading is extremely fast and has no
            negative impact.
          </p>
        </div>
      </div>

      {error && <ErrorBlock>{error}</ErrorBlock>}

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingText}>Loading...</div>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.noItemsContainer}>
          <div className={styles.noItemsText}>No background images found.</div>
        </div>
      ) : (
        <div className={styles.itemsOuterContainer}>
          <div className={styles.itemsContainer}>
            {items.map((item) => (
              <div key={item.uid} className={styles.itemContainer}>
                <button
                  className={styles.itemImageButton}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelected(item);
                  }}>
                  <OsehImage
                    uid={item.imageFile.uid}
                    jwt={item.imageFile.jwt}
                    displayWidth={180}
                    displayHeight={368}
                    alt={`by ${
                      item.uploadedByUserSub
                    } at ${item.imageFileCreatedAt.toLocaleString()}`}
                    handler={imageHandler}
                  />
                </button>
              </div>
            ))}
          </div>
          <div className={styles.controlsContainer}>
            <div className={styles.resetContainer}>
              <Button type="button" variant="link" onClick={reset}>
                Refresh
              </Button>
            </div>
            {haveMore && (
              <div className={styles.loadMoreContainer}>
                <Button type="button" onClick={loadNext}>
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
