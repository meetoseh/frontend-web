import { ReactElement, useCallback, useContext, useState } from 'react';
import { IconButton } from '../../../shared/forms/IconButton';
import { CrudItemBlock } from '../../crud/CrudItemBlock';
import { IntroductoryJourney } from './IntroductoryJourney';
import styles from './IntroductoryJourneyBlock.module.css';
import iconStyles from '../../crud/icons.module.css';
import { CompactJourney } from '../CompactJourney';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { describeError, ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../shared/ApiConstants';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';

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
  const [error, setError] = useState<ReactElement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onDelete = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      setError(<>You need to login again.</>);
      return;
    }
    const loginContext = loginContextUnch;

    setDeleting(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/api/1/journeys/introductory/${journey.uid}`,
        {
          method: 'DELETE',
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      onDeleted.apply(undefined, [journey]);
    } catch (e) {
      setError(await describeError(e));
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
        {error && <ErrorBlock>{error}</ErrorBlock>}
        <CompactJourney journey={journey.journey} imageHandler={imageHandler} />
      </div>
    </CrudItemBlock>
  );
};
