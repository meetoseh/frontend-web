import { ReactElement, useCallback, useContext, useState } from 'react';
import { IconButton } from '../../../shared/forms/IconButton';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import { IntroductoryJourney } from './IntroductoryJourney';
import styles from './IntroductoryJourneyBlock.module.css';
import iconStyles from '../../crud/icons.module.css';
import { CompactJourney } from '../CompactJourney';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { BoxError, chooseErrorFromStatus, DisplayableError } from '../../../shared/lib/errors';

type IntroductoryJourneyBlockProps = {
  journey: IntroductoryJourney;
  /**
   * Called after the user requests to delete this introductory journey and we
   * make the request to the server and it succeeds. Provided the journey that
   * was deleted.
   */
  onDeleted: (this: undefined, item: IntroductoryJourney) => void;

  /**
   * Called after the user requests to change this introductory journey and
   * we make the request to the server and it succeeds. Provided the new
   * journey.
   */
  onChanged: (this: undefined, newItem: IntroductoryJourney) => void;

  /**
   * The handler for fetching images
   */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Shows an introductory journey and provides controls to delete/edit it as
 * appropriate.
 */
export const IntroductoryJourneyBlock = ({
  journey,
  onDeleted,
  onChanged,
  imageHandler,
}: IntroductoryJourneyBlockProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [error, setError] = useState<DisplayableError | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onDelete = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      setError(new DisplayableError('server-refresh-required', 'delete journey', 'not logged in'));
      return;
    }
    const loginContext = loginContextUnch;

    setDeleting(true);
    setError(null);
    try {
      let response;
      try {
        response = await apiFetch(
          `/api/1/journeys/introductory/${journey.uid}`,
          {
            method: 'DELETE',
          },
          loginContext
        );
      } catch {
        throw new DisplayableError('connectivity', 'delete journey');
      }

      if (!response.ok) {
        throw chooseErrorFromStatus(response.status, 'delete journey');
      }

      onDeleted.apply(undefined, [journey]);
    } catch (e) {
      setError(
        e instanceof DisplayableError ? e : new DisplayableError('client', 'delete journey', `${e}`)
      );
    } finally {
      setDeleting(false);
    }
  }, [loginContextRaw.value, onDeleted, journey]);

  return (
    <CrudItemBlock
      title={journey.journey.title}
      controls={
        <>
          <IconButton
            icon={iconStyles.delete}
            srOnlyName={'Delete'}
            disabled={deleting}
            onClick={onDelete}
          />
        </>
      }>
      <div className={styles.container}>
        {error && <BoxError error={error} />}
        <CompactJourney journey={journey.journey} imageHandler={imageHandler} />
      </div>
    </CrudItemBlock>
  );
};
