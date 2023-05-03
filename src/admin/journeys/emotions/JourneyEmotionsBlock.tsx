import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import styles from './JourneyEmotionsBlock.module.css';
import { ErrorBlock, describeError } from '../../../shared/forms/ErrorBlock';
import { LoginContext } from '../../../shared/LoginContext';
import { ModalContext, addModalWithCallbackToRemove } from '../../../shared/ModalContext';
import { apiFetch } from '../../../shared/ApiConstants';
import { ModalWrapper } from '../../../shared/ModalWrapper';
import { JourneyEmotion, parseJourneyEmotion } from './JourneyEmotion';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { Button } from '../../../shared/forms/Button';
import { Emotion } from '../../emotions/Emotion';
import { EmotionDropdown } from '../../emotions/EmotionDropdown';

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
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [viewingEmotion, setViewingEmotion] = useState<Emotion | null>(null);
  const [addingEmotion, setAddingEmotion] = useState<boolean>(false);
  const [error, setError] = useState<ReactElement | null>(null);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    let active = true;
    fetchEmotions();
    return () => {
      active = false;
    };

    async function fetchEmotionsInner() {
      const response = await apiFetch(
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
      if (!response.ok) {
        throw response;
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
        const err = await describeError(e);
        if (active) {
          setError(err);
        }
      }
    }
  }, [journeyUid, loginContext]);

  useEffect(() => {
    if (viewingEmotion === null) {
      return;
    }

    const handleDelete = () => {
      setViewingEmotion(null);
      setEmotions((prev) => prev.filter((emotion) => emotion.word !== viewingEmotion.word));
    };

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setViewingEmotion(null)}>
        <JourneyEmotionDetails
          journeyUid={journeyUid}
          emotion={viewingEmotion}
          onDeleted={handleDelete}
        />
      </ModalWrapper>
    );
  }, [modalContext.setModals, viewingEmotion, journeyUid]);

  useEffect(() => {
    if (!addingEmotion) {
      return;
    }

    const handleAdd = (emotion: JourneyEmotion) => {
      setAddingEmotion(false);
      setEmotions((prev) => [...prev, { word: emotion.emotion }]);
    };

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setAddingEmotion(false)}>
        <JourneyAddEmotion
          journeyUid={journeyUid}
          onAdded={handleAdd}
          existingEmotions={emotions}
        />
      </ModalWrapper>
    );
  }, [modalContext.setModals, addingEmotion, journeyUid, emotions]);

  const boundOnClick = useMemo(
    () => emotions.map((emotion) => () => setViewingEmotion(emotion)),
    [emotions]
  );

  const onAddEmotionClick = useCallback(() => setAddingEmotion(true), []);

  return (
    <div className={styles.container}>
      {error && <ErrorBlock>{error}</ErrorBlock>}
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
  const loginContext = useContext(LoginContext);
  const [info, setInfo] = useState<JourneyEmotion | null>(null);
  const [error, setError] = useState<ReactElement | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteDisabled, setDeleteDisabled] = useState<boolean>(true);

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    let active = true;
    fetchInfo();
    return () => {
      active = false;
    };

    async function fetchInfoInner() {
      const response = await apiFetch(
        `/api/1/journeys/emotions/?journey_uid=${journeyUid}&emotion=${encodeURIComponent(
          emotion.word
        )}`,
        {
          method: 'GET',
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
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
        const err = await describeError(e);
        if (active) {
          setError(err);
        }
      }
    }
  }, [journeyUid, emotion, loginContext]);

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
    if (loginContext.state !== 'logged-in') {
      setError(<>You must be logged in to do that</>);
      return;
    }

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
      const err = await describeError(e);
      setError(err);
    } finally {
      setDeleting(false);
    }
  }, [journeyUid, emotion, loginContext, onDeleted]);

  return (
    <div className={styles.emotionDetailsContainer}>
      {error && <ErrorBlock>{error}</ErrorBlock>}
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
  const loginContext = useContext(LoginContext);
  const [error, setError] = useState<ReactElement | null>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);

  const localFilter = useCallback(
    (emotion: Emotion): boolean => {
      return existingEmotions.find((e) => e.word === emotion.word) === undefined;
    },
    [existingEmotions]
  );

  const onAddPressed = useCallback(async () => {
    if (loginContext.state !== 'logged-in') {
      setError(<>You must be logged in to do that</>);
      return;
    }

    if (emotion === null) {
      setError(<>You must select an emotion to add</>);
      return;
    }

    setError(null);
    try {
      const response = await apiFetch(
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

      if (!response.ok) {
        throw response;
      }

      const raw: any = await response.json();
      const journeyEmotion = parseJourneyEmotion(raw);
      onAdded(journeyEmotion);
    } catch (e) {
      const err = await describeError(e);
      setError(err);
    }
  }, [loginContext, emotion, onAdded, journeyUid]);

  return (
    <div className={styles.addContainer}>
      <div className={styles.addTitle}>Add Emotion</div>
      {error && <ErrorBlock>{error}</ErrorBlock>}
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
