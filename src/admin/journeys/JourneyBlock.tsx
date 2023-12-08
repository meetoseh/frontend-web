import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { IconButton } from '../../shared/forms/IconButton';
import { OsehContent } from '../../shared/content/OsehContent';
import { OsehImage } from '../../shared/images/OsehImage';
import { CrudFormElement } from '../crud/CrudFormElement';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { Journey } from './Journey';
import styles from './JourneyBlock.module.css';
import iconStyles from '../crud/icons.module.css';
import { Button } from '../../shared/forms/Button';
import { JourneyBackgroundImage } from './background_images/JourneyBackgroundImage';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/contexts/ModalContext';
import { CreateJourneyUploadBackgroundImage } from './CreateJourneyUploadBackgroundImage';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { CreateJourneyChooseBackgroundImage } from './CreateJourneyChooseBackgroundImage';
import { JourneySubcategory } from './subcategories/JourneySubcategory';
import { Instructor } from '../instructors/Instructor';
import { TextInput } from '../../shared/forms/TextInput';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingKeymap } from '../crud/CrudFetcher';
import { keyMap as journeyKeyMap } from './Journeys';
import { Checkbox } from '../../shared/forms/Checkbox';
import { InstructorPicker } from '../instructors/InstructorPicker';
import { JourneySubcategoryPicker } from './subcategories/JourneySubcategoryPicker';
import { JourneyEmotionsBlock } from './emotions/JourneyEmotionsBlock';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { CompactJourney } from './CompactJourney';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';

type JourneyBlockProps = {
  /**
   * The journey to display
   */
  journey: Journey;

  /**
   * Used to update the journey after a confirmation from the server
   */
  setJourney: (this: void, journey: Journey) => void;

  /**
   * The handler for loading images
   */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Shows a journey and allows editing it, including soft-deleting
 */
export const JourneyBlock = ({
  journey,
  setJourney,
  imageHandler,
}: JourneyBlockProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<ReactElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBackgroundImage, setNewBackgroundImage] = useState<JourneyBackgroundImage | null>(null);
  const [showUploadImage, setShowUploadImage] = useState(false);
  const [showChooseImage, setShowChooseImage] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState<JourneySubcategory | null>(null);
  const [subcategoryQuery, setSubcategoryQuery] = useState('');
  const [newInstructor, setNewInstructor] = useState<Instructor | null>(null);
  const [instructorQuery, setInstructorQuery] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [newDeleted, setNewDeleted] = useState(false);
  const [currentVariationOfJourney, setCurrentVariationOfJourney] = useState<Journey | null>(null);
  const [variations, setVariations] = useState<Journey[]>([]);

  useEffect(() => {
    setNewTitle(journey.title);
  }, [journey.title]);

  useEffect(() => {
    setSubcategoryQuery(newSubcategory?.internalName ?? journey.subcategory.internalName);
  }, [newSubcategory, journey.subcategory.internalName]);

  useEffect(() => {
    setInstructorQuery(newInstructor?.name ?? journey.instructor.name);
  }, [newInstructor, journey.instructor.name]);

  useEffect(() => {
    setNewDescription(journey.description);
  }, [journey.description]);

  useEffect(() => {
    setNewPromptText(journey.prompt.text);
  }, [journey.prompt.text]);

  useEffect(() => {
    setNewDeleted(journey.deletedAt !== null);
  }, [journey.deletedAt]);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;

        let active = true;
        fetchVariationOfJourney();
        return () => {
          active = false;
        };

        async function fetchVariationOfJourney() {
          setCurrentVariationOfJourney(null);
          if (journey.variationOfJourneyUID === null || loginContext.state !== 'logged-in') {
            return;
          }

          const response = await apiFetch(
            '/api/1/journeys/search',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                filters: { uid: { operator: 'eq', value: journey.variationOfJourneyUID } },
              }),
            },
            loginContext
          );
          if (!response.ok) {
            console.log(
              'failed to fetch variation of journey',
              response.status,
              await response.text()
            );
            return;
          }
          const data: { items: any[] } = await response.json();
          if (data.items.length < 1) {
            console.log('failed to fetch variation of journey: no items');
            return;
          }

          if (!active) {
            return;
          }

          const variation = convertUsingKeymap(data.items[0], journeyKeyMap);
          setCurrentVariationOfJourney(variation);
        }
      },
      [journey.variationOfJourneyUID]
    )
  );

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          return;
        }
        const loginContext = loginContextUnch;
        let active = true;
        fetchVariations();
        return () => {
          active = false;
        };
        async function fetchVariations() {
          setVariations([]);
          if (loginContext.state !== 'logged-in') {
            return;
          }

          const response = await apiFetch(
            '/api/1/journeys/search',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                filters: {
                  variation_of_journey_uid: { operator: 'eq', value: journey.uid },
                  ...(journey.deletedAt === null
                    ? {
                        deleted_at: { operator: 'eq', value: null },
                      }
                    : {}),
                },
              }),
            },
            loginContext
          );
          if (!response.ok) {
            console.log(
              'failed to fetch variations of journey',
              response.status,
              await response.text()
            );
            return;
          }
          const data: { items: any[] } = await response.json();
          if (!active) {
            return;
          }

          const variations = data.items.map((item) => convertUsingKeymap(item, journeyKeyMap));
          setVariations(variations);
        }
      },
      [journey.uid, journey.deletedAt]
    )
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);

    let timeout: NodeJS.Timeout | null = null;
    const onResize = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(handleResize, 100);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!showUploadImage) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper onClosed={() => setShowUploadImage(false)}>
        <CreateJourneyUploadBackgroundImage
          onUploaded={(image) => {
            setNewBackgroundImage(image);
            setShowUploadImage(false);
          }}
        />
      </ModalWrapper>
    );
  }, [showUploadImage, modalContext.modals]);

  useEffect(() => {
    if (!showChooseImage) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.modals,
      <ModalWrapper onClosed={() => setShowChooseImage(false)}>
        <CreateJourneyChooseBackgroundImage
          onSelected={(image) => {
            setNewBackgroundImage(image);
            setShowChooseImage(false);
          }}
          imageHandler={imageHandler}
        />
      </ModalWrapper>
    );
  }, [showChooseImage, modalContext.modals, imageHandler]);

  const save = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;

    setSaving(true);
    setError(null);
    let newJourney = journey;

    try {
      const requestData: any = {};
      if (newTitle !== journey.title) {
        requestData.title = newTitle;
      }
      if (
        newBackgroundImage !== null &&
        newBackgroundImage.imageFile.uid !== journey.backgroundImage.uid
      ) {
        requestData.journey_background_image_uid = newBackgroundImage.uid;
      }
      if (newSubcategory !== null && newSubcategory.uid !== journey.subcategory.uid) {
        requestData.journey_subcategory_uid = newSubcategory.uid;
      }
      if (newInstructor !== null && newInstructor.uid !== journey.instructor.uid) {
        requestData.instructor_uid = newInstructor.uid;
      }
      if (newDescription !== journey.description) {
        requestData.description = newDescription;
      }
      if (newPromptText !== journey.prompt.text) {
        requestData.prompt = Object.assign({}, journey.prompt, { text: newPromptText });
      }

      if (Object.keys(requestData).length > 0) {
        const response = await apiFetch(
          `/api/1/journeys/${journey.uid}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify(requestData),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        newJourney = Object.assign({}, journey, convertUsingKeymap(data, journeyKeyMap));
      }

      if (newDeleted !== (journey.deletedAt !== null)) {
        if (newDeleted) {
          const response = await apiFetch(
            `/api/1/journeys/${journey.uid}`,
            {
              method: 'DELETE',
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          newJourney = Object.assign({}, journey, convertUsingKeymap(data, journeyKeyMap));
        } else {
          const response = await apiFetch(
            `/api/1/journeys/${journey.uid}/undelete`,
            {
              method: 'POST',
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          newJourney = Object.assign({}, journey, { deletedAt: null });
        }
      }

      setEditing(false);
    } catch (e) {
      console.error('error saving journey', e);
      const err = await describeError(e);
      setError(err);
    } finally {
      if (journey !== newJourney) {
        setJourney(newJourney);
      }
      setSaving(false);
    }
  }, [
    journey,
    loginContextRaw.value,
    newBackgroundImage,
    newDescription,
    newInstructor,
    newPromptText,
    newSubcategory,
    newTitle,
    setJourney,
    newDeleted,
  ]);

  const onInstructorSelected = useCallback((instr: Instructor) => {
    setNewInstructor(instr);
    setInstructorQuery('');
  }, []);

  const onJourneySubcategorySelected = useCallback((subcat: JourneySubcategory | null) => {
    setNewSubcategory(subcat);
    setSubcategoryQuery('');
  }, []);

  return (
    <CrudItemBlock
      title={journey.title}
      controls={
        <>
          <IconButton
            icon={editing ? iconStyles.check : iconStyles.pencil}
            srOnlyName={editing ? 'Save' : 'Edit'}
            disabled={saving}
            onClick={() => {
              if (editing) {
                save();
              } else {
                setEditing(true);
              }
            }}
          />
        </>
      }>
      <div className={styles.container}>
        {error && <ErrorBlock>{error}</ErrorBlock>}

        {journey.deletedAt !== null ? (
          <div className={styles.deletedAtContainer}>
            <CrudFormElement title="Deleted At">
              {journey.deletedAt.toLocaleString()}
            </CrudFormElement>
          </div>
        ) : null}

        <JourneyEmotionsBlock journeyUid={journey.uid} />

        {journey.variationOfJourneyUID !== null ? (
          <div className={styles.variationOfJourneyContainer}>
            <CrudFormElement title="Variation Of">
              {currentVariationOfJourney === null ? (
                journey.variationOfJourneyUID
              ) : (
                <CompactJourney
                  journey={currentVariationOfJourney}
                  showViews={false}
                  imageHandler={imageHandler}
                />
              )}
            </CrudFormElement>
          </div>
        ) : null}

        {variations.length > 0 && (
          <div className={styles.variationsContainer}>
            <CrudFormElement title="Variations">
              <div className={styles.variationsList}>
                {variations.map((variation) => (
                  <CompactJourney
                    key={variation.uid}
                    journey={variation}
                    imageHandler={imageHandler}
                  />
                ))}
              </div>
            </CrudFormElement>
          </div>
        )}

        {journey.specialCategory !== null && journey.specialCategory !== undefined ? (
          <div className={styles.specialCategoryContainer}>
            <CrudFormElement title="Special Category">{journey.specialCategory}</CrudFormElement>
          </div>
        ) : null}

        {editing && (
          <TextInput
            label="Title"
            value={newTitle}
            help={null}
            disabled={false}
            inputStyle="normal"
            onChange={setNewTitle}
            html5Validation={null}
          />
        )}
        <CrudFormElement title="Audio Content">
          {editing && (
            <p className={styles.audioContentEditWarning}>
              You cannot change the audio content of a journey once it's created.
            </p>
          )}
          <div className={styles.audioContentContainer}>
            <OsehContent uid={journey.audioContent.uid} jwt={journey.audioContent.jwt} />
          </div>
        </CrudFormElement>
        <CrudFormElement title="Background Image">
          {(editing && (
            <div className={styles.backgroundImageEditContainer}>
              <div className={styles.backgroundImageContainer}>
                <OsehImage
                  uid={(newBackgroundImage?.imageFile || journey.backgroundImage).uid}
                  jwt={(newBackgroundImage?.imageFile || journey.backgroundImage).jwt}
                  displayWidth={isMobile ? 180 : 480}
                  displayHeight={isMobile ? 368 : 270}
                  alt="Background"
                  handler={imageHandler}
                />
              </div>
              <div className={styles.backgroundImageEditButtons}>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={saving}
                  onClick={() => setShowUploadImage(true)}>
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="link"
                  disabled={saving}
                  onClick={() => setShowChooseImage(true)}>
                  Choose
                </Button>
              </div>
            </div>
          )) || (
            <div className={styles.backgroundImageContainer}>
              <OsehImage
                uid={journey.backgroundImage.uid}
                jwt={journey.backgroundImage.jwt}
                displayWidth={isMobile ? 180 : 480}
                displayHeight={isMobile ? 368 : 270}
                alt="Background"
                handler={imageHandler}
              />
            </div>
          )}
        </CrudFormElement>
        <CrudFormElement title="Categorization">
          {(editing && (
            <div className={styles.editCategorizationContainer}>
              <JourneySubcategoryPicker
                query={subcategoryQuery}
                setQuery={setSubcategoryQuery}
                setSelected={onJourneySubcategorySelected}
              />
            </div>
          )) || (
            <>
              {journey.subcategory.internalName} (displayed as {journey.subcategory.externalName})
            </>
          )}
        </CrudFormElement>

        <CrudFormElement title="Instructor">
          {(editing && (
            <div className={styles.editInstructorContainer}>
              <InstructorPicker
                query={instructorQuery}
                setQuery={setInstructorQuery}
                setSelected={onInstructorSelected}
                imageHandler={imageHandler}
              />
            </div>
          )) || (
            <div className={styles.instructorContainer}>
              {journey.instructor.picture && (
                <div className={styles.instructorPictureContainer}>
                  <OsehImage
                    uid={journey.instructor.picture.uid}
                    jwt={journey.instructor.picture.jwt}
                    displayWidth={60}
                    displayHeight={60}
                    alt="Instructor"
                    handler={imageHandler}
                  />
                </div>
              )}
              <div className={styles.instructorNameContainer}>{journey.instructor.name}</div>
            </div>
          )}
        </CrudFormElement>

        <CrudFormElement title="Description">
          {(editing && (
            <TextInput
              label="Description"
              value={newDescription}
              help={null}
              disabled={false}
              inputStyle="normal"
              onChange={setNewDescription}
              html5Validation={null}
            />
          )) || <>{journey.description}</>}
        </CrudFormElement>

        <CrudFormElement title="Prompt">
          <div className={styles.promptContainer}>
            {editing && (
              <div className={styles.promptEditContainer}>
                <p className={styles.promptEditWarning}>
                  You cannot change most prompt settings of a journey once it's created.
                </p>
                <TextInput
                  label="Prompt Text"
                  value={newPromptText}
                  help={null}
                  disabled={false}
                  inputStyle="normal"
                  onChange={setNewPromptText}
                  html5Validation={null}
                />
              </div>
            )}
            <pre>
              <code>
                {JSON.stringify(
                  editing
                    ? Object.assign({}, journey.prompt, { text: newPromptText })
                    : journey.prompt,
                  undefined,
                  2
                )}
              </code>
            </pre>
          </div>
        </CrudFormElement>

        {editing && (
          <div className={styles.editDeletedContainer}>
            <Checkbox
              label="Deleted"
              value={newDeleted}
              setValue={setNewDeleted}
              disabled={saving}
            />
          </div>
        )}

        <CrudFormElement title="UID">
          <div className={styles.uidContainer}>
            <pre>{journey.uid}</pre>
          </div>
        </CrudFormElement>

        <CrudFormElement title="Sample">
          <div className={styles.sampleContainer}>
            {journey.sample ? (
              <OsehContent
                uid={journey.sample.uid}
                jwt={journey.sample.jwt}
                showAs="video"
                playerStyle={{ width: '270px', height: '480px' }}
              />
            ) : (
              <>Still processing.</>
            )}
          </div>
        </CrudFormElement>

        <CrudFormElement title="Full Video">
          <div className={styles.videoContainer}>
            {journey.video ? (
              <OsehContent
                uid={journey.video.uid}
                jwt={journey.video.jwt}
                showAs="video"
                playerStyle={{ width: '270px', height: '480px' }}
              />
            ) : (
              <>Still processing.</>
            )}
          </div>
        </CrudFormElement>
      </div>
    </CrudItemBlock>
  );
};
