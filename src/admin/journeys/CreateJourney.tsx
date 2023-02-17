import {
  MouseEvent,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '../../shared/forms/Button';
import { LoginContext } from '../../shared/LoginContext';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { OsehContent } from '../../shared/OsehContent';
import { OsehImage } from '../../shared/OsehImage';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import { JourneyAudioContent } from './audio_contents/JourneyAudioContent';
import { JourneyBackgroundImage } from './background_images/JourneyBackgroundImage';
import styles from './CreateJourney.module.css';
import { CreateJourneyChooseAudioContent } from './CreateJourneyChooseAudioContent';
import { CreateJourneyChooseBackgroundImage } from './CreateJourneyChooseBackgroundImage';
import { CreateJourneyUploadAudioContent } from './CreateJourneyUploadAudioContent';
import { CreateJourneyUploadBackgroundImage } from './CreateJourneyUploadBackgroundImage';
import { Journey } from './Journey';
import { JourneySubcategory } from './subcategories/JourneySubcategory';
import { Instructor } from '../instructors/Instructor';
import { TextInput } from '../../shared/forms/TextInput';
import { AdminJourneyPrompt } from './prompts/AdminJourneyPrompt';
import { AdminJourneyPromptPicker, defaultPrompt } from './prompts/AdminJourneyPromptPicker';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingKeymap } from '../crud/CrudFetcher';
import { keyMap as journeyKeyMap } from './Journeys';
import { JourneySubcategoryPicker } from './subcategories/JourneySubcategoryPicker';
import { InstructorPicker } from '../instructors/InstructorPicker';
import { cO } from 'chart.js/dist/chunks/helpers.core';

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
  const [backgroundImage, setBackgroundImage] = useState<JourneyBackgroundImage | null>(null);
  const [showAddBackgroundImageModal, setShowAddBackgroundImageModal] = useState(false);
  const [showChooseBackgroundImageModal, setShowChooseBackgroundImageModal] = useState(false);
  const [backgroundImagePreviewType, setBackgroundImagePreviewType] = useState<
    'original' | 'darkened' | 'blurred'
  >('darkened');
  const [subcategory, setSubcategory] = useState<JourneySubcategory | null>(null);
  const [subcategoryQuery, setSubcategoryQuery] = useState('');
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [instructorQuery, setInstructorQuery] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState<AdminJourneyPrompt>(defaultPrompt);
  const [promptValid, setPromptValid] = useState(true);
  const [error, setError] = useState<ReactElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [createErrorCollapsed, setCreateErrorCollapsed] = useState(true);

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
        <CreateJourneyChooseAudioContent
          onSelected={(content) => {
            setAudioContent(content);
            setShowChooseAudioContentModal(false);
          }}
        />
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

  useEffect(() => {
    if (!showChooseBackgroundImageModal) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setShowChooseBackgroundImageModal(false)}>
        <CreateJourneyChooseBackgroundImage
          onSelected={(image) => {
            setBackgroundImage(image);
            setShowChooseBackgroundImageModal(false);
          }}
        />
      </ModalWrapper>
    );
  }, [showChooseBackgroundImageModal, modalContext.setModals]);

  const create = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setSaving(true);
      setError(null);
      try {
        let response: Response;
        try {
          response = await apiFetch(
            '/api/1/journeys/',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                journey_audio_content_uid: audioContent?.uid,
                journey_background_image_uid: backgroundImage?.uid,
                journey_subcategory_uid: subcategory?.uid,
                instructor_uid: instructor?.uid,
                title,
                description,
                prompt,
              }),
            },
            loginContext
          );
        } catch (e) {
          setError(<>Failed to connect to server. Check your internet connection.</>);
          return;
        }

        if (!response.ok) {
          setError(await describeErrorFromResponse(response));
          return;
        }

        const raw = await response.json();
        const journey = convertUsingKeymap(raw, journeyKeyMap);
        journey.deletedAt = null;

        onCreated(journey);
        setAudioContent(null);
        setBackgroundImage(null);
        setSubcategory(null);
        setInstructor(null);
        setTitle('');
        setDescription('');
        setPrompt(defaultPrompt);
      } finally {
        setSaving(false);
      }
    },
    [
      loginContext,
      audioContent,
      backgroundImage,
      description,
      instructor,
      prompt,
      subcategory,
      title,
      onCreated,
    ]
  );

  useEffect(() => {
    if (!showAddBackgroundImageModal) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setShowAddBackgroundImageModal(false)}>
        <CreateJourneyUploadBackgroundImage
          onUploaded={(image) => {
            setBackgroundImage(image);
            setShowAddBackgroundImageModal(false);
          }}
        />
      </ModalWrapper>
    );
  }, [showAddBackgroundImageModal, modalContext.setModals]);

  const onBackgroundImagePreviewTypeChanged = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const type = e.target.value;
      if (type !== 'original' && type !== 'darkened' && type !== 'blurred') {
        throw new Error(`Invalid preview type: ${type}`);
      }

      setBackgroundImagePreviewType(type);
    },
    []
  );

  const onSubcategorySelected = useCallback((subcat: JourneySubcategory | null) => {
    setSubcategory(subcat);
    setSubcategoryQuery('');
  }, []);

  const onInstructorSelected = useCallback((instr: Instructor) => {
    setInstructor(instr);
    setInstructorQuery('');
  }, []);

  const previewImage =
    backgroundImage === null
      ? null
      : {
          original: backgroundImage.imageFile,
          darkened: backgroundImage.darkenedImageFile,
          blurred: backgroundImage.blurredImageFile,
        }[backgroundImagePreviewType];

  const cantCreateReasons = useMemo(() => {
    const result = [];
    if (audioContent === null) {
      result.push('Audio content is not selected');
    }
    if (backgroundImage === null) {
      result.push('Background image is not selected');
    }
    if (subcategory === null) {
      result.push('Subcategory is not selected');
    }
    if (instructor === null) {
      result.push('Instructor is not selected');
    }
    if (title === '') {
      result.push('Title is empty');
    }
    if (description === '') {
      result.push('Description is empty');
    }
    if (description.length > 255) {
      result.push('Description is too long');
    }
    if (!promptValid) {
      result.push('Prompt is invalid');
    }
    return result;
  }, [audioContent, backgroundImage, subcategory, instructor, title, description, promptValid]);

  const onCreateErrorCollapsedClicked = useCallback(() => {
    setCreateErrorCollapsed((c) => !c);
  }, []);

  return (
    <CrudCreateBlock>
      <div className={styles.container}>
        <CrudFormElement title="Audio Content">
          {audioContent !== null ? (
            <div className={styles.selectedContainer}>
              <div>
                <OsehContent
                  uid={audioContent.contentFile.uid}
                  jwt={audioContent.contentFile.jwt}
                />
              </div>
              <div>
                <Button type="button" variant="link" onClick={() => setAudioContent(null)}>
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.chooseOrAddContainer}>
              <div>
                <Button
                  type="button"
                  variant="filled"
                  onClick={() => setShowAddAudioContentModal(true)}>
                  Upload
                </Button>
              </div>
              <div>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowChooseAudioContentModal(true)}>
                  Choose
                </Button>
              </div>
            </div>
          )}
        </CrudFormElement>
        <CrudFormElement title="Background Image">
          {previewImage !== null ? (
            <>
              <div className={styles.previewTypeContainer}>
                <select
                  className={styles.previewType}
                  value={backgroundImagePreviewType}
                  onChange={onBackgroundImagePreviewTypeChanged}>
                  <option value="original">Original</option>
                  <option value="darkened">Darkened</option>
                  <option value="blurred">Blurred</option>
                </select>
              </div>
              <div className={styles.selectedContainer}>
                <div>
                  <OsehImage
                    uid={previewImage.uid}
                    jwt={previewImage.jwt}
                    displayWidth={180}
                    displayHeight={368}
                    alt="Mobile Preview"
                  />
                </div>
                <div>
                  <OsehImage
                    uid={previewImage.uid}
                    jwt={previewImage.jwt}
                    displayWidth={270}
                    displayHeight={480}
                    alt="Share to Instagram Preview"
                  />
                </div>
                <div>
                  <OsehImage
                    uid={previewImage.uid}
                    jwt={previewImage.jwt}
                    displayWidth={480}
                    displayHeight={270}
                    alt="Desktop Preview"
                  />
                </div>
                <div>
                  <Button type="button" variant="outlined" onClick={() => setBackgroundImage(null)}>
                    Clear
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.chooseOrAddContainer}>
              <div>
                <Button
                  type="button"
                  variant="filled"
                  onClick={() => setShowAddBackgroundImageModal(true)}>
                  Upload
                </Button>
              </div>
              <div>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setShowChooseBackgroundImageModal(true)}>
                  Choose
                </Button>
              </div>
            </div>
          )}
        </CrudFormElement>
        <CrudFormElement title="Categorization">
          {subcategory !== null ? (
            <div className={styles.categorySelectedContainer}>
              <div>
                {subcategory.internalName} (displayed as {subcategory.externalName})
              </div>
              <div>
                <Button type="button" variant="link-small" onClick={() => setSubcategory(null)}>
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.categoryPickerContainer}>
              <JourneySubcategoryPicker
                query={subcategoryQuery}
                setQuery={setSubcategoryQuery}
                setSelected={onSubcategorySelected}
              />
            </div>
          )}
        </CrudFormElement>
        <CrudFormElement title="Instructor">
          {instructor !== null ? (
            <div className={styles.instructorSelectedContainer}>
              <div className={styles.instructorContainer}>
                {instructor.picture !== null ? (
                  <div className={styles.instructorPictureContainer}>
                    <OsehImage
                      uid={instructor.picture.uid}
                      jwt={instructor.picture.jwt}
                      displayWidth={60}
                      displayHeight={60}
                      alt="Profile"
                    />
                  </div>
                ) : null}
                {instructor.name}
              </div>
              <div>
                <Button type="button" variant="link-small" onClick={() => setInstructor(null)}>
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.instructorPickerContainer}>
              <InstructorPicker
                query={instructorQuery}
                setQuery={setInstructorQuery}
                setSelected={onInstructorSelected}
              />
            </div>
          )}
        </CrudFormElement>
        <TextInput
          label="Title"
          value={title}
          help={null}
          disabled={false}
          inputStyle="normal"
          onChange={setTitle}
          html5Validation={null}
        />
        <TextInput
          label="Description"
          value={description}
          help={null}
          disabled={false}
          inputStyle="normal"
          onChange={setDescription}
          html5Validation={null}
        />
        <AdminJourneyPromptPicker
          prompt={prompt}
          setPrompt={setPrompt}
          setPromptValid={setPromptValid}
        />
        {error && <ErrorBlock>{error}</ErrorBlock>}
        <div className={styles.submitButtonContainer}>
          <Button
            type="button"
            variant="filled"
            onClick={create}
            disabled={cantCreateReasons.length > 0 || saving}>
            Create
          </Button>
        </div>
        {cantCreateReasons.length > 0 && createErrorCollapsed && (
          <div className={styles.createErrorCollapsedContainer}>
            <Button type="button" variant="link-small" onClick={onCreateErrorCollapsedClicked}>
              Confused?
            </Button>
          </div>
        )}
        {cantCreateReasons.length > 0 && !createErrorCollapsed && (
          <div className={styles.createErrorContainer}>
            <div className={styles.hideCreateErrorContainer}>
              <Button type="button" variant="link-small" onClick={onCreateErrorCollapsedClicked}>
                Hide
              </Button>
            </div>
            <div className={styles.createErrorReasonsContainer}>
              {cantCreateReasons.map((reason, index) => (
                <div key={index} className={styles.createErrorReasonContainer}>
                  {reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CrudCreateBlock>
  );
};
