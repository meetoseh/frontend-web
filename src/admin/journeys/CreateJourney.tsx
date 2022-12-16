import { ReactElement, useContext, useEffect, useState } from 'react';
import { Button } from '../../shared/forms/Button';
import { LoginContext } from '../../shared/LoginContext';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { OsehContent } from '../../shared/OsehContent';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import { JourneyAudioContent } from './audio_contents/JourneyAudioContent';
import styles from './CreateJourney.module.css';
import { CreateJourneyUploadAudioContent } from './CreateJourneyUploadAudioContent';
import { Journey } from './Journey';

type CreateJourneyProps = {
  /**
   * Called after we successfully create a journey
   */
  onCreated: (this: void, journey: Journey) => void;
};

/**
 * Component to create journeys. Journey creation is unusually complicated
 * as there are nested components (audio, image) which cannot be null.
 */
export const CreateJourney = ({ onCreated }: CreateJourneyProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [audioContent, setAudioContent] = useState<JourneyAudioContent | null>(null);
  const [showAddAudioContentModal, setShowAddAudioContentModal] = useState(false);
  const [showChooseAudioContentModal, setShowChooseAudioContentModal] = useState(false);

  useEffect(() => {
    if (showAddAudioContentModal && loginContext.state !== 'logged-in') {
      setShowAddAudioContentModal(false);
    }
  }, [loginContext, showAddAudioContentModal]);

  useEffect(() => {
    if (!showChooseAudioContentModal) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setShowChooseAudioContentModal(false)}>
        Look at me, a modal!
      </ModalWrapper>
    );
  }, [modalContext.setModals, showChooseAudioContentModal]);

  useEffect(() => {
    if (!showAddAudioContentModal) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setShowAddAudioContentModal(false)}>
        <CreateJourneyUploadAudioContent
          onUploaded={(content) => {
            setAudioContent(content);
            setShowAddAudioContentModal(false);
          }}
        />
      </ModalWrapper>
    );
  }, [modalContext.setModals, showAddAudioContentModal]);

  return (
    <CrudCreateBlock>
      <div className={styles.container}>
        <CrudFormElement title="Audio Content">
          <div className={styles.audioContentOuterContainer}>
            {audioContent && (
              <div className={styles.audioContentSelectedContainer}>
                <OsehContent
                  uid={audioContent.contentFile.uid}
                  jwt={audioContent.contentFile.jwt}
                />
              </div>
            )}
            <div className={styles.audioContentContainer}>
              <div className={styles.audioContentChooseContainer}>
                <Button type="button" onClick={() => setShowChooseAudioContentModal(true)}>
                  Choose
                </Button>
              </div>
              <div className={styles.audioContentAddContainer}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => setShowAddAudioContentModal(true)}>
                  Upload
                </Button>
              </div>
            </div>
          </div>
        </CrudFormElement>
      </div>
    </CrudCreateBlock>
  );
};
