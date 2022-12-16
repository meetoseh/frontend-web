import { ReactElement, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/ApiConstants';
import { Button } from '../../shared/forms/Button';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { LoginContext } from '../../shared/LoginContext';
import { OsehContent } from '../../shared/OsehContent';
import { convertUsingKeymap } from '../crud/CrudFetcher';
import { JourneyAudioContent } from './audio_contents/JourneyAudioContent';
import { keyMap as journeyAudioContentKeyMap } from './audio_contents/JourneyAudioContents';
import styles from './CreateJourneyChooseAudioContent.module.css';

type CreateJourneyChooseAudioContentProps = {
  /**
   * Called when the user selects which audio content to use for the journey
   */
  onSelected: (this: void, audioContent: JourneyAudioContent) => void;
};

export const CreateJourneyChooseAudioContent = ({
  onSelected,
}: CreateJourneyChooseAudioContentProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<JourneyAudioContent[]>([]);
  const [error, setError] = useState<ReactElement | null>(null);

  useEffect(() => {
    let active = true;
    fetchItems();
    return () => {
      active = false;
    };

    async function fetchItems() {
      setError(null);
      if (loginContext.state !== 'logged-in') {
        return;
      }

      setLoading(true);
      try {
        let response: Response;
        try {
          response = await apiFetch(
            '/api/1/journeys/audio_contents/search',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                sort: [
                  {
                    key: 'last_uploaded_at',
                    dir: 'desc',
                  },
                ],
                limit: 6,
              }),
            },
            loginContext
          );
        } catch (e) {
          if (!active) {
            return;
          }
          console.error(e);
          setError(<>Failed to connect to server. Check your internet connection.</>);
          return;
        }

        if (!active) {
          return;
        }

        if (!response.ok) {
          const err = await describeErrorFromResponse(response);
          if (!active) {
            return;
          }
          setError(err);
          return;
        }

        const raw: { items: any[] } = await response.json();
        if (!active) {
          return;
        }

        const items: JourneyAudioContent[] = raw.items.map((item) =>
          convertUsingKeymap(item, journeyAudioContentKeyMap)
        );
        setItems(items);
      } catch (e) {
        console.error(e);
        setError(<>An unexpected error occurred. Contact support.</>);
      } finally {
        setLoading(false);
      }
    }
  }, [loginContext]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>Choose Audio Content</div>
      <div className={styles.help}>
        <p>
          Choose from recent uploaded audio content below. The content is shown from most recently
          uploaded to least recently uploaded.
        </p>
        <p>
          It is usually easier to use the upload option to select a local file, as audio content is
          automatically de-duplicated: re-uploading is extremely fast and has no negative impact.
        </p>
      </div>

      {error && <ErrorBlock>{error}</ErrorBlock>}

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingText}>Loading...</div>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.noItemsContainer}>
          <div className={styles.noItemsText}>
            No audio content has been uploaded yet. Please upload some audio content first.
          </div>
        </div>
      ) : (
        <div className={styles.itemsContainer}>
          {items.map((item) => (
            <div className={styles.itemContainer} key={item.uid}>
              <div className={styles.itemAudioContainer}>
                <OsehContent uid={item.contentFile.uid} jwt={item.contentFile.jwt} />
              </div>
              <div className={styles.itemButtonContainer}>
                <Button variant="outlined" type="button" onClick={() => onSelected(item)}>
                  Select
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
