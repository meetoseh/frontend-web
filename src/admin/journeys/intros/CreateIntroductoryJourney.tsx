import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { Button } from '../../../shared/forms/Button';
import { describeError, ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { LoginContext } from '../../../shared/LoginContext';
import { CrudCreateBlock } from '../../crud/CrudCreateBlock';
import { Journey } from '../Journey';
import { JourneyPicker } from '../JourneyPicker';
import { IntroductoryJourney } from './IntroductoryJourney';
import styles from './CreateIntroductoryJourney.module.css';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingKeymap } from '../../crud/CrudFetcher';
import { keyMap as introductoryJourneyKeyMap } from './IntroductoryJourney';
import { CompactJourney } from '../CompactJourney';

type CreateIntroductoryJourneyProps = {
  /**
   * The function to call when the journey is created, after its been confirmed
   * with the server. Passed the resulting journey so that it may be displayed
   * on the screen without having to refresh the page.
   */
  onCreated: (this: undefined, item: IntroductoryJourney) => void;
};

/**
 * Provides the ability to create a new introductory journey.
 */
export const CreateIntroductoryJourney = ({
  onCreated,
}: CreateIntroductoryJourneyProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setValid(journey !== null);
  }, [journey]);

  const trySave = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      if (loginContext.state !== 'logged-in') {
        console.warn('Not logged in, not saving');
        return;
      }

      if (journey === null) {
        console.warn('Saved without journey, ignoring');
        return;
      }

      event.preventDefault();
      setError(null);
      setSaving(true);
      try {
        const response = await apiFetch(
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

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        const newJourney = convertUsingKeymap(data, introductoryJourneyKeyMap);
        onCreated.apply(undefined, [newJourney]);
        setJourney(null);
        setQuery('');
      } catch (e) {
        setError(await describeError(e));
      } finally {
        setSaving(false);
      }
    },
    [journey, loginContext, onCreated]
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
              <CompactJourney journey={journey} />
              <div className={styles.journeyClearContainer}>
                <Button type="button" variant="link" onClick={clearJourney} disabled={saving}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
        {error && <ErrorBlock>{error}</ErrorBlock>}
        <Button type="submit" disabled={saving || !valid}>
          Create
        </Button>
      </form>
    </CrudCreateBlock>
  );
};
