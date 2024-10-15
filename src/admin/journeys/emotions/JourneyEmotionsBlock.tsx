import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import styles from './JourneyEmotionsBlock.module.css';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { ModalContext, addModalWithCallbackToRemove } from '../../../shared/contexts/ModalContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { ModalWrapper } from '../../../shared/ModalWrapper';
import { JourneyEmotion, parseJourneyEmotion } from './JourneyEmotion';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { Button } from '../../../shared/forms/Button';
import { Emotion } from '../../emotions/Emotion';
import { EmotionDropdown } from '../../emotions/EmotionDropdown';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { BoxError, chooseErrorFromStatus, DisplayableError } from '../../../shared/lib/errors';

type JourneyEmotionsBlockProps = {
  /**
   * The UID of the journey whose emotions will be loaded
   */
  journeyUid: string;
};

/**
 * Loads the emotions for the journey with the given uid, and displays
 * them as a series of tags, plus one additional tag to add a new emotion.
 *
 * If the user clicks on one of the existing tags, a popup is displayed
 * containing additional information about the relationship and an option
 * to delete it.
 */
export const JourneyEmotionsBlock = ({ journeyUid }: JourneyEmotionsBlockProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [viewingEmotion, setViewingEmotion] = useState<Emotion | null>(null);
  const [addingEmotion, setAddingEmotion] = useState<boolean>(false);
  const [error, setError] = useState<DisplayableError | null>(null);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchEmotions();
        return () => {
          active = false;
        };

        async function fetchEmotionsInner() {
          let response;
          try {
            response = await apiFetch(
              '/api/1/emotions/search',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                  filters: {
                    journey_uid: {
                      operator: 'eq',
                      value: journeyUid,
                    },
                  },
                  limit: 100,
                }),
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'fetch emotions');
          }
          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'fetch emotions');
          }
          const data: { items: Emotion[] } = await response.json();
          if (active) {
            setEmotions(data.items);
          }
        }

        async function fetchEmotions() {
          try {
            await fetchEmotionsInner();
          } catch (e) {
            const err =
              e instanceof DisplayableError
                ? e
                : new DisplayableError('client', 'fetch emotions', `${e}`);
            if (active) {
              setError(err);
            }
          }
        }
      },
      [journeyUid]
    )
  );

  useEffect(() => {
    if (viewingEmotion === null) {
      return;
    }

    const handleDelete = () => {
      setViewingEmotion(null);
      setEmotions((prev) => prev.filter((emotion) => emotion.word !== viewingEmotion.word));
    };

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper onClosed={() => setViewingEmotion(null)}>
        <JourneyEmotionDetails
          journeyUid={journeyUid}
          emotion={viewingEmotion}
          onDeleted={handleDelete}
        />
      </ModalWrapper>
    );
  }, [modalContext.modals, viewingEmotion, journeyUid]);

  useEffect(() => {
    if (!addingEmotion) {
      return;
    }

    const handleAdd = (emotion: JourneyEmotion) => {
      setAddingEmotion(false);
      setEmotions((prev) => [...prev, { word: emotion.emotion }]);
    };

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper onClosed={() => setAddingEmotion(false)}>
        <JourneyAddEmotion
          journeyUid={journeyUid}
          onAdded={handleAdd}
          existingEmotions={emotions}
        />
      </ModalWrapper>
    );
  }, [modalContext.modals, addingEmotion, journeyUid, emotions]);

  const boundOnClick = useMemo(
    () => emotions.map((emotion) => () => setViewingEmotion(emotion)),
    [emotions]
  );

  const onAddEmotionClick = useCallback(() => setAddingEmotion(true), []);

  return (
    <div className={styles.container}>
      {error && <BoxError error={error} />}
      {emotions.map((emotion, idx) => (
        <button className={styles.emotion} key={emotion.word} onClick={boundOnClick[idx]}>
          {emotion.word}
        </button>
      ))}
      <button className={styles.addEmotion} onClick={onAddEmotionClick}>
        +
      </button>
    </div>
  );
};

const JourneyEmotionDetails = ({
  journeyUid,
  emotion,
  onDeleted,
}: {
  journeyUid: string;
  emotion: Emotion;
  onDeleted: () => void;
}) => {
  const loginContextRaw = useContext(LoginContext);
  const [info, setInfo] = useState<JourneyEmotion | null>(null);
  const [error, setError] = useState<DisplayableError | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteDisabled, setDeleteDisabled] = useState<boolean>(true);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchInfo();
        return () => {
          active = false;
        };

        async function fetchInfoInner() {
          let response;
          try {
            response = await apiFetch(
              `/api/1/journeys/emotions/?journey_uid=${journeyUid}&emotion=${encodeURIComponent(
                emotion.word
              )}`,
              {
                method: 'GET',
              },
              loginContext
            );
          } catch {
            throw new DisplayableError('connectivity', 'get journey emotion details');
          }

          if (!response.ok) {
            throw chooseErrorFromStatus(response.status, 'get journey emotion details');
          }

          const raw: any = await response.json();
          const data = parseJourneyEmotion(raw);
          if (active) {
            setInfo(data);
          }
        }

        async function fetchInfo() {
          try {
            await fetchInfoInner();
          } catch (e) {
            const err =
              e instanceof DisplayableError
                ? e
                : new DisplayableError('client', 'get journey emotion details', `${e}`);
            if (active) {
              setError(err);
            }
          }
        }
      },
      [journeyUid, emotion]
    )
  );

  useEffect(() => {
    if (info === null || deleting) {
      setDeleteDisabled(true);
      return;
    }

    let active = true;
    let timeout: NodeJS.Timeout | null = null;
    timeout = setTimeout(() => {
      timeout = null;
      if (active) {
        setDeleteDisabled(false);
      }
    }, 1000);
    return () => {
      active = false;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  }, [info, deleting]);

  const onDeletePressed = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      setError(
        new DisplayableError('server-refresh-required', 'delete journey emotion', 'not logged in')
      );
      return;
    }
    const loginContext = loginContextUnch;

    setDeleting(true);
    try {
      const response = await apiFetch(
        '/api/1/journeys/emotions/',
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            journey_uid: journeyUid,
            emotion: emotion.word,
          }),
        },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }
      onDeleted();
    } catch (e) {
      const err = new DisplayableError('connectivity', 'delete journey emotion');
      setError(err);
    } finally {
      setDeleting(false);
    }
  }, [journeyUid, emotion, loginContextRaw.value, onDeleted]);

  return (
    <div className={styles.emotionDetailsContainer}>
      {error && <BoxError error={error} />}
      <CrudFormElement title="Emotion">
        <div className={styles.emotionTitle}>{emotion.word}</div>
      </CrudFormElement>
      <CrudFormElement title="Creation Hint">
        <pre className={styles.emotionDetailsCreationHint}>
          {info === null
            ? 'Loading...'
            : info.creationHint === null
            ? 'Not set'
            : JSON.stringify(info.creationHint, null, 2)}
        </pre>
      </CrudFormElement>
      <CrudFormElement title="Attached At">
        <div className={styles.attachedAt}>
          {info === null ? 'Loading...' : info.createdAt.toLocaleString()}
        </div>
      </CrudFormElement>
      <div className={styles.emotionDetailsDeleteButtonContainer}>
        <Button
          type="button"
          disabled={deleteDisabled}
          onClick={onDeletePressed}
          variant="filled"
          fullWidth>
          Delete
        </Button>
      </div>
    </div>
  );
};

const JourneyAddEmotion = ({
  journeyUid,
  onAdded,
  existingEmotions,
}: {
  journeyUid: string;
  onAdded: (item: JourneyEmotion) => void;
  existingEmotions: Emotion[];
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const [error, setError] = useState<DisplayableError | null>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);

  const localFilter = useCallback(
    (emotion: Emotion): boolean => {
      return existingEmotions.find((e) => e.word === emotion.word) === undefined;
    },
    [existingEmotions]
  );

  const onAddPressed = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      setError(new DisplayableError('server-refresh-required', 'add emotion', 'not logged in'));
      return;
    }
    const loginContext = loginContextUnch;

    if (emotion === null) {
      setError(new DisplayableError('client', 'add emotion', 'no emotion selected'));
      return;
    }

    setError(null);
    try {
      let response;
      try {
        response = await apiFetch(
          '/api/1/journeys/emotions/',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journeyUid,
              emotion: emotion.word,
            }),
          },
          loginContext
        );
      } catch {
        throw new DisplayableError('connectivity', 'add emotion');
      }

      if (!response.ok) {
        throw chooseErrorFromStatus(response.status, 'add emotion');
      }

      const raw: any = await response.json();
      const journeyEmotion = parseJourneyEmotion(raw);
      onAdded(journeyEmotion);
    } catch (e) {
      const err =
        e instanceof DisplayableError ? e : new DisplayableError('client', 'add emotion', `${e}`);
      setError(err);
    }
  }, [loginContextRaw.value, emotion, onAdded, journeyUid]);

  return (
    <div className={styles.addContainer}>
      <div className={styles.addTitle}>Add Emotion</div>
      {error && <BoxError error={error} />}
      <EmotionDropdown setSelected={setEmotion} localFilter={localFilter} />
      <div className={styles.addButtonContainer}>
        <Button
          type="button"
          variant="filled"
          fullWidth
          disabled={emotion === null}
          onClick={onAddPressed}>
          Add
        </Button>
      </div>
    </div>
  );
};
