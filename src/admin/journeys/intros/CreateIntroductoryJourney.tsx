import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { Button } from '../../../shared/forms/Button';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { CrudCreateBlock } from '../../crud/CrudCreateBlock';
import { Journey } from '../Journey';
import { JourneyPicker } from '../JourneyPicker';
import { IntroductoryJourney } from './IntroductoryJourney';
import styles from './CreateIntroductoryJourney.module.css';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../crud/CrudFetcher';
import { keyMap as introductoryJourneyKeyMap } from './IntroductoryJourney';
import { CompactJourney } from '../CompactJourney';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { BoxError, chooseErrorFromStatus, DisplayableError } from '../../../shared/lib/errors';

type CreateIntroductoryJourneyProps = {
  /**
   * The function to call when the journey is created, after its been confirmed
   * with the server. Passed the resulting journey so that it may be displayed
   * on the screen without having to refresh the page.
   */
  onCreated: (this: undefined, item: IntroductoryJourney) => void;

  /**
   * The handler for fetching images
   */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Provides the ability to create a new introductory journey.
 */
export const CreateIntroductoryJourney = ({
  onCreated,
  imageHandler,
}: CreateIntroductoryJourneyProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState<DisplayableError | null>(null);
  const [saving, setSaving] = useState(false);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setValid(journey !== null);
  }, [journey]);

  const trySave = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;

      if (journey === null) {
        console.warn('Saved without journey, ignoring');
        return;
      }

      event.preventDefault();
      setError(null);
      setSaving(true);
      try {
        let response;
        try {
          response = await apiFetch(
            '/api/1/journeys/introductory/',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                journey_uid: journey.uid,
              }),
            },
            loginContext
          );
        } catch {
          throw new DisplayableError('connectivity', 'save journey');
        }

        if (!response.ok) {
          throw chooseErrorFromStatus(response.status, 'save journey');
        }

        const data = await response.json();
        const newJourney = convertUsingKeymap(data, introductoryJourneyKeyMap);
        onCreated.apply(undefined, [newJourney]);
        setJourney(null);
        setQuery('');
      } catch (e) {
        setError(
          e instanceof DisplayableError ? e : new DisplayableError('client', 'save journey', `${e}`)
        );
      } finally {
        setSaving(false);
      }
    },
    [journey, loginContextRaw.value, onCreated]
  );

  const clearJourney = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setJourney(null);
    setQuery('');
  }, []);

  return (
    <CrudCreateBlock>
      <form onSubmit={trySave}>
        <div className={styles.journeyPickerContainer}>
          {journey === null ? (
            <JourneyPicker
              query={query}
              setQuery={setQuery}
              setSelected={setJourney}
              filterIsIntroductory={true}
              disabled={saving}
            />
          ) : (
            <div className={styles.journeyPickedContainer}>
              <CompactJourney journey={journey} imageHandler={imageHandler} />
              <div className={styles.journeyClearContainer}>
                <Button type="button" variant="link" onClick={clearJourney} disabled={saving}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
        {error && <BoxError error={error} />}
        <Button type="submit" disabled={saving || !valid}>
          Create
        </Button>
      </form>
    </CrudCreateBlock>
  );
};
