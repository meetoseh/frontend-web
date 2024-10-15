import { Fragment, ReactElement, useCallback, useContext, useEffect } from 'react';
import {
  OsehImageRequestedState,
  OsehImageStateRequestHandler,
} from '../../shared/images/useOsehImageStateRequestHandler';
import { Course, courseKeyMap } from './Course';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import styles from './CourseDetails.module.css';
import iconStyles from '../crud/icons.module.css';
import { LoginContext, LoginContextValueLoggedIn } from '../../shared/contexts/LoginContext';
import { setVWC } from '../../shared/lib/setVWC';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { IconButton } from '../../shared/forms/IconButton';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { useUnwrappedValueWithCallbacks } from '../../shared/hooks/useUnwrappedValueWithCallbacks';
import { CrudFormElement } from '../crud/CrudFormElement';
import { CrudSwappableString } from '../lib/CrudSwappableString';
import { UseCourseJourneysResult, useCourseJourneys } from './journeys/useCourseJourneys';
import { CompactJourney } from '../journeys/CompactJourney';
import { CourseBackgroundImage } from './background_images/CourseBackgroundImage';
import { OsehImageState } from '../../shared/images/OsehImageState';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { OsehImageRef } from '../../shared/images/OsehImageRef';
import { useValuesWithCallbacksEffect } from '../../shared/hooks/useValuesWithCallbacksEffect';
import { useWindowSizeValueWithCallbacks } from '../../shared/hooks/useWindowSize';
import { OsehImageFromState } from '../../shared/images/OsehImageFromState';
import { CrudSwappableElement } from '../lib/CrudSwappableElement';
import { Button } from '../../shared/forms/Button';
import { showCourseBackgroundImageUploader } from './background_images/showCourseBackgroundImageUploader';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/contexts/ModalContext';
import { showCourseBackgroundImageSelector } from './background_images/showCourseBackgroundImageSelector';
import { CourseHeroImage } from './hero_images/CourseHeroImage';
import { showCourseHeroImageUploader } from './hero_images/showCourseHeroImageUploader';
import { showCourseHeroImageSelector } from './hero_images/showCourseHeroImageSelector';
import { CourseLogo } from './logos/CourseLogo';
import { showCourseLogoUploader } from './logos/showCourseLogoUploader';
import { showCourseLogoSelector } from './logos/showCourseLogoSelector';
import { CourseVideo } from './videos/CourseVideo';
import { OsehContent } from '../../shared/content/OsehContent';
import { showCourseVideoUploader } from './videos/showCourseVideoUploader';
import { showCourseVideoSelector } from './videos/showCourseVideoSelector';
import { createVideoSizeComparerForTarget } from '../../shared/content/createVideoSizeComparerForTarget';
import { CourseVideoThumbnail } from './videos/thumbnails/CourseVideoThumbnail';
import { apiFetch } from '../../shared/ApiConstants';
import { showYesNoModal } from '../../shared/lib/showYesNoModal';
import { showCourseVideoThumbnailSelector } from './videos/thumbnails/showCourseVideoThumbnailSelector';
import { showCourseVideoThumbnailUploader } from './videos/thumbnails/showCourseVideoThumbnailUploader';
import { CourseFlags } from './flags/CourseFlags';
import { convertUsingMapper } from '../crud/CrudFetcher';
import { FLAG_NAMES } from './CourseFilterAndSortBlock';
import { Checkbox } from '../../shared/forms/Checkbox';
import { Instructor } from '../instructors/Instructor';
import { OsehImage } from '../../shared/images/OsehImage';
import { showInstructorPicker } from '../instructors/showInstructorPicker';
import { combineClasses } from '../../shared/lib/combineClasses';
import { showEditCourseJourneyAssociationModal } from './journeys/showEditCourseJourneyAssociationModal';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { CourseJourney, courseJourneyKeyMap } from './journeys/CourseJourney';
import { Journey } from '../journeys/Journey';
import { JourneyPicker } from '../journeys/JourneyPicker';
import { adaptValueWithCallbacksAsSetState } from '../../shared/lib/adaptValueWithCallbacksAsSetState';
import {
  chooseErrorFromStatus,
  DisplayableError,
  SimpleDismissBoxError,
} from '../../shared/lib/errors';

export type CourseDetailsProps = {
  /**
   * The course to display
   */
  course: Course;

  /**
   * Used to update the course after a confirmation from the server
   */
  setCourse: (this: void, course: Course) => void;

  /**
   * The handler for loading images
   */
  imageHandler: OsehImageStateRequestHandler;

  /**
   * Used to store if the user is trying to edit the course currently;
   * this should be used to show a confirmation dialog if the user tries to
   * close the page
   */
  editingVWC: WritableValueWithCallbacks<boolean>;

  /**
   * We write a save function here which can be called to try and save the
   * current client-side state, usually called from the confirmation dialog.
   * If this succeeds, editingVWC will be set to false.
   */
  saveIfNecessary: WritableValueWithCallbacks<() => Promise<void>>;
};

/**
 * Shows details on the given course with the ability to edit; expected to be
 * shown in a modal
 */
export const CourseDetails = ({
  course,
  setCourse,
  imageHandler,
  editingVWC,
  saveIfNecessary,
}: CourseDetailsProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const errorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  const savingVWC = useWritableValueWithCallbacks(() => false);
  const newTitleVWC = useWritableValueWithCallbacks(() => course.title);
  const newSlugVWC = useWritableValueWithCallbacks(() => course.slug);
  const newInstructorVWC = useWritableValueWithCallbacks<Instructor | null>(() => null);
  const newFlagsVWC = useWritableValueWithCallbacks<CourseFlags>(() => course.flags);
  const newDescriptionVWC = useWritableValueWithCallbacks(() => course.description);
  const newBackgroundVWC = useWritableValueWithCallbacks<CourseBackgroundImage | null>(() => null);
  const newHeroVWC = useWritableValueWithCallbacks<CourseHeroImage | null>(() => null);
  const newLogoVWC = useWritableValueWithCallbacks<CourseLogo | null>(() => null);
  const newVideoVWC = useWritableValueWithCallbacks<CourseVideo | null>(() => null);
  const newVideoThumbnailVWC = useWritableValueWithCallbacks<CourseVideoThumbnail | null>(
    () => null
  );

  useEffect(() => {
    setVWC(errorVWC, null);
    setVWC(newTitleVWC, course.title);
    setVWC(newSlugVWC, course.slug);
    setVWC(newInstructorVWC, null);
    setVWC(newFlagsVWC, course.flags);
    setVWC(newDescriptionVWC, course.description);
    setVWC(newBackgroundVWC, null);
    setVWC(newHeroVWC, null);
    setVWC(newLogoVWC, null);
    setVWC(newVideoVWC, null);
    setVWC(newVideoThumbnailVWC, null);
  }, [
    course,
    errorVWC,
    newTitleVWC,
    newSlugVWC,
    newInstructorVWC,
    newFlagsVWC,
    newDescriptionVWC,
    newBackgroundVWC,
    newHeroVWC,
    newLogoVWC,
    newVideoVWC,
    newVideoThumbnailVWC,
  ]);

  const saveInner = useCallback(
    async (signal: AbortSignal | undefined) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('Not logged in');
      }
      const loginContext = loginContextUnch;

      const precondition = {
        slug: course.slug,
        flags: course.flags,
        revenue_cat_entitlement: course.revenueCatEntitlement,
        title: course.title,
        description: course.description,
        instructor_uid: course.instructor.uid,
        background_original_image_uid: course.backgroundOriginalImage?.uid ?? null,
        background_darkened_image_uid: course.backgroundDarkenedImage?.uid ?? null,
        video_content_uid: course.videoContent?.uid ?? null,
        video_thumbnail_uid: course.videoThumbnail?.uid ?? null,
        logo_image_uid: course.logoImage?.uid ?? null,
        hero_image_uid: course.heroImage?.uid ?? null,
      };
      const patch: any & object = {};

      const newSlug = newSlugVWC.get();
      if (newSlug !== course.slug) {
        patch.slug = newSlug;
      }

      const newFlags = newFlagsVWC.get();
      if (newFlags !== course.flags) {
        patch.flags = newFlags;
      }

      const newTitle = newTitleVWC.get();
      if (newTitle !== course.title) {
        patch.title = newTitle;
      }

      const newDescription = newDescriptionVWC.get();
      if (newDescription !== course.description) {
        patch.description = newDescription;
      }

      const newInstructor = newInstructorVWC.get();
      if (newInstructor !== null && newInstructor.uid !== course.instructor.uid) {
        patch.instructor_uid = newInstructor.uid;
      }

      const newBackground = newBackgroundVWC.get();
      if (
        newBackground !== null &&
        (newBackground.originalImageFile.uid !== course.backgroundOriginalImage?.uid ||
          newBackground.darkenedImageFile.uid !== course.backgroundDarkenedImage?.uid)
      ) {
        patch.background_image_uid = newBackground.uid;
      }

      const newVideo = newVideoVWC.get();
      if (newVideo !== null && newVideo.contentFile.uid !== course.videoContent?.uid) {
        patch.video_content_uid = newVideo.uid;
      }

      const newThumbnail = newVideoThumbnailVWC.get();
      if (newThumbnail !== null && newThumbnail.imageFile.uid !== course.videoThumbnail?.uid) {
        patch.video_thumbnail_uid = newThumbnail.uid;
      }

      const newLogo = newLogoVWC.get();
      if (newLogo !== null && newLogo.imageFile.uid !== course.logoImage?.uid) {
        patch.logo_image_uid = newLogo.uid;
      }

      const newHero = newHeroVWC.get();
      if (newHero !== null && newHero.imageFile.uid !== course.heroImage?.uid) {
        patch.hero_image_uid = newHero.uid;
      }

      signal?.throwIfAborted();
      const response = await apiFetch(
        '/api/1/courses/',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            uid: course.uid,
            precondition,
            patch,
          }),
          signal,
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const raw = await response.json();
      const parsed = convertUsingMapper(raw, courseKeyMap);
      setCourse(parsed);
    },
    [
      course,
      loginContextRaw.value,
      newBackgroundVWC,
      newDescriptionVWC,
      newInstructorVWC,
      newFlagsVWC,
      newHeroVWC,
      newLogoVWC,
      newSlugVWC,
      newTitleVWC,
      newVideoThumbnailVWC,
      newVideoVWC,
      setCourse,
    ]
  );

  const tryAndSave = useCallback(
    async (signal: AbortSignal | undefined) => {
      signal?.throwIfAborted();

      if (savingVWC.get()) {
        return;
      }

      setVWC(savingVWC, true);
      try {
        await saveInner(signal);
        signal?.throwIfAborted();
        setVWC(editingVWC, false);
      } catch (e) {
        signal?.throwIfAborted();
        const desc =
          e instanceof DisplayableError ? e : new DisplayableError('client', 'save', `${e}`);
        signal?.throwIfAborted();
        setVWC(errorVWC, desc);
      } finally {
        setVWC(savingVWC, false);
      }
    },
    [editingVWC, errorVWC, saveInner, savingVWC]
  );

  const saveIfEditing = useCallback(
    async (signal: AbortSignal | undefined) => {
      if (!editingVWC.get()) {
        return;
      }
      await tryAndSave(signal);
    },
    [editingVWC, tryAndSave]
  );

  useEffect(() => {
    setVWC(saveIfNecessary, () => saveIfEditing(undefined));
  }, [saveIfNecessary, saveIfEditing]);

  const editingAndSavingVWC = useMappedValuesWithCallbacks(
    [editingVWC, savingVWC],
    () => ({
      editing: editingVWC.get(),
      saving: savingVWC.get(),
    }),
    {
      outputEqualityFn: (a, b) => a.editing === b.editing && a.saving === b.saving,
    }
  );

  const journeys = useCourseJourneys({ courseUid: course.uid });

  return (
    <CrudItemBlock
      title={course.title}
      controls={
        <RenderGuardedComponent
          props={editingAndSavingVWC}
          component={({ editing, saving }) => (
            <IconButton
              icon={editing ? iconStyles.check : iconStyles.pencil}
              srOnlyName={editing ? 'Save' : 'Edit'}
              disabled={saving}
              onClick={async () => {
                if (editing) {
                  await tryAndSave(undefined);
                } else {
                  setVWC(editingVWC, true);
                }
              }}
            />
          )}
        />
      }>
      <div className={styles.container}>
        <SimpleDismissBoxError error={errorVWC} />
        <CrudSwappableString editingVWC={editingVWC} title="Title" vwc={newTitleVWC} />
        <CrudSwappableString editingVWC={editingVWC} title="Slug" vwc={newSlugVWC} />
        <CrudSwappableString editingVWC={editingVWC} title="Description" vwc={newDescriptionVWC} />
        <CrudFormElement title="UID">{course.uid}</CrudFormElement>
        <CourseInstructor
          course={course}
          newInstructorVWC={newInstructorVWC}
          imageHandler={imageHandler}
          editingVWC={editingVWC}
        />
        <CourseJourneys
          course={course}
          editingVWC={editingVWC}
          journeys={journeys}
          imageHandler={imageHandler}
        />
        <CourseBackground
          course={course}
          editingVWC={editingVWC}
          newBackgroundVWC={newBackgroundVWC}
          imageHandler={imageHandler}
        />
        <CourseHero
          course={course}
          editingVWC={editingVWC}
          newHeroVWC={newHeroVWC}
          imageHandler={imageHandler}
        />
        <CourseLogoElement
          course={course}
          editingVWC={editingVWC}
          newLogoVWC={newLogoVWC}
          imageHandler={imageHandler}
        />
        <CourseVideoElement
          course={course}
          editingVWC={editingVWC}
          newVideoVWC={newVideoVWC}
          newThumbnailVWC={newVideoThumbnailVWC}
        />
        <CourseVideoThumbnailElement
          course={course}
          editingVWC={editingVWC}
          newVideoThumbnailVWC={newVideoThumbnailVWC}
          imageHandler={imageHandler}
        />
        <CrudFormElement title="RevenueCat Entitlement">
          <code>{course.revenueCatEntitlement}</code>
        </CrudFormElement>
        <CourseFlagsElement course={course} editingVWC={editingVWC} newFlagsVWC={newFlagsVWC} />
      </div>
    </CrudItemBlock>
  );
};

const CourseInstructor = ({
  course,
  newInstructorVWC,
  imageHandler,
  editingVWC,
}: {
  course: Course;
  newInstructorVWC: WritableValueWithCallbacks<Instructor | null>;
  imageHandler: OsehImageStateRequestHandler;
  editingVWC: ValueWithCallbacks<boolean>;
}): ReactElement => {
  const modalContext = useContext(ModalContext);
  return (
    <CrudFormElement title="Instructor">
      <div className={styles.instructorContainer}>
        <RenderGuardedComponent
          props={newInstructorVWC}
          component={(newInstructor) => {
            const instructor = newInstructor ?? course.instructor;
            return (
              <>
                {instructor.picture !== null && (
                  <div className={styles.instructorPictureContainer}>
                    <OsehImage
                      {...instructor.picture}
                      displayWidth={60}
                      displayHeight={60}
                      handler={imageHandler}
                      alt=""
                    />
                  </div>
                )}
                {instructor.name}
              </>
            );
          }}
        />
        <CrudSwappableElement
          version={editingVWC}
          falsey={() => <></>}
          truthy={() => (
            <>
              <Button
                type="button"
                variant="link"
                onClick={async (e) => {
                  e.preventDefault();
                  const choice = await showInstructorPicker({
                    modals: modalContext.modals,
                    imageHandler,
                  }).promise;
                  if (choice !== undefined) {
                    setVWC(newInstructorVWC, choice);
                  }
                }}>
                Choose
              </Button>
            </>
          )}
        />
      </div>
    </CrudFormElement>
  );
};

const CourseJourneys = ({
  course,
  journeys,
  imageHandler,
  editingVWC,
}: {
  course: Course;
  journeys: UseCourseJourneysResult;
  imageHandler: OsehImageStateRequestHandler;
  editingVWC: ValueWithCallbacks<boolean>;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);

  const loading = useUnwrappedValueWithCallbacks(journeys.loading);
  const itemsAndEditingVWC = useMappedValuesWithCallbacks([journeys.items, editingVWC], () => ({
    items: journeys.items.get(),
    editing: editingVWC.get(),
  }));
  const saveError = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  const journeyQuery = useWritableValueWithCallbacks<string>(() => '');

  const setPriority = useCallback(
    async (loginContext: LoginContextValueLoggedIn, item: CourseJourney, priority: number) => {
      let response;
      try {
        response = await apiFetch(
          '/api/1/courses/journeys/',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              association_uid: item.associationUid,
              precondition: {
                course_uid: item.courseUid,
                journey_uid: item.journey.uid,
              },
              patch: {
                priority,
              },
            }),
          },
          loginContext
        );
      } catch {
        throw new DisplayableError(
          'connectivity',
          `set priority for ${item.journey.title} to ${priority}`
        );
      }
      if (!response.ok) {
        throw chooseErrorFromStatus(
          response.status,
          `set priority for ${item.journey.title} to ${priority}`
        );
      }
      const newRaw = await response.json();
      const newCJ = convertUsingMapper(newRaw, courseJourneyKeyMap);
      journeys.onChange(newCJ);
    },
    [journeys]
  );

  const addJourney = useCallback(
    async (journey: Journey) => {
      if (journeys.loading.get()) {
        throw new Error('loading');
      }

      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('not logged in');
      }
      const loginContext = loginContextUnch;

      const items = journeys.items.get();
      const highestPriority =
        items.length === 0 ? 0 : Math.max(...items.map((itm) => itm.priority));
      const priority = highestPriority + 10;

      let response;
      try {
        response = await apiFetch(
          '/api/1/courses/journeys/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              journey_uid: journey.uid,
              course_uid: course.uid,
              priority,
            }),
          },
          loginContext
        );
      } catch {
        throw new DisplayableError('connectivity', 'add journey');
      }

      if (!response.ok) {
        throw chooseErrorFromStatus(response.status, 'add journey');
      }

      const raw = await response.json();
      const parsed = convertUsingMapper(raw, courseJourneyKeyMap);
      journeys.onAdd(parsed);
    },
    [loginContextRaw.value, journeys, course.uid]
  );

  const cleanupPriorities = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      throw new Error('not logged in');
    }
    const loginContext = loginContextUnch;

    if (journeys.loading.get()) {
      throw new Error('loading');
    }

    let items = [...journeys.items.get()];
    if (items.length === 0) {
      return;
    }

    const desiredPriorities = items.map((_, i) => (i + 1) * 10);
    if (!items.some((itm, idx) => itm.priority !== desiredPriorities[idx])) {
      return;
    }

    const desiredPrioritiesSet = new Set(desiredPriorities);
    if (
      items.some(
        (itm, idx) =>
          itm.priority !== desiredPriorities[idx] && desiredPrioritiesSet.has(itm.priority)
      )
    ) {
      const offset =
        Math.max(
          ...items.map((itm) => itm.priority),
          desiredPriorities[desiredPriorities.length - 1]
        ) + 1;

      await Promise.all(items.map((itm, idx) => setPriority(loginContext, itm, idx + offset)));
      items = [...journeys.items.get()];
    }

    await Promise.all(
      items.map((itm, idx) =>
        itm.priority === desiredPriorities[idx]
          ? Promise.resolve()
          : setPriority(loginContext, itm, desiredPriorities[idx])
      )
    );
  }, [loginContextRaw.value, journeys.loading, journeys.items, setPriority]);

  return (
    <CrudFormElement title="Journeys">
      <SimpleDismissBoxError error={journeys.error} />
      <SimpleDismissBoxError error={saveError} />
      {loading ? (
        'Loading...'
      ) : (
        <>
          <RenderGuardedComponent
            props={itemsAndEditingVWC}
            component={({ items, editing }) => {
              if (items.length === 0) {
                return <>No items</>;
              }

              return (
                <div
                  className={combineClasses(
                    styles.journeys,
                    editing ? styles.journeysEditing : undefined
                  )}>
                  {items.map((item) => (
                    <div className={styles.journey} key={item.associationUid}>
                      <CompactJourney journey={item.journey} imageHandler={imageHandler} />
                      {editing && (
                        <>
                          <div className={styles.journeyPriority}>
                            Priority: {item.priority.toLocaleString()}
                          </div>
                          <Button
                            type="button"
                            variant="link"
                            onClick={(e) => {
                              e.preventDefault();
                              showEditCourseJourneyAssociationModal({
                                journeys,
                                item,
                                loginContextRaw,
                                modals: modalContext.modals,
                                imageHandler,
                              });
                            }}>
                            Edit
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <CrudSwappableElement
            version={editingVWC}
            falsey={() => <></>}
            truthy={() => (
              <div className={styles.journeysEditControls}>
                <CrudFormElement title="Add Journey">
                  <div className={styles.journeysAddContainer}>
                    <RenderGuardedComponent
                      props={journeyQuery}
                      component={(query) => (
                        <JourneyPicker
                          query={query}
                          setQuery={adaptValueWithCallbacksAsSetState(journeyQuery)}
                          setSelected={async (journey) => {
                            setVWC(saveError, null);

                            const closeOverlay = addModalWithCallbackToRemove(
                              modalContext.modals,
                              <ModalWrapper onClosed={() => {}} minimalStyling />
                            );
                            try {
                              await addJourney(journey);
                              setVWC(journeyQuery, '');
                            } catch (e) {
                              setVWC(
                                saveError,
                                e instanceof DisplayableError
                                  ? e
                                  : new DisplayableError('client', 'add journey', `${e}`)
                              );
                            } finally {
                              closeOverlay();
                            }
                          }}
                        />
                      )}
                      applyInstantly
                    />
                  </div>
                </CrudFormElement>
                <Button
                  type="button"
                  variant="filled"
                  onClick={async (e) => {
                    e.preventDefault();
                    const confirmation = await showYesNoModal(modalContext.modals, {
                      title: 'Cleanup Priorities?',
                      body: 'This will try to give the first journey priority 10, the next 20, etc.',
                      cta1: 'Cleanup',
                      cta2: 'Cancel',
                      emphasize: 1,
                    }).promise;
                    if (!confirmation) {
                      return;
                    }

                    const closeOverlay = addModalWithCallbackToRemove(
                      modalContext.modals,
                      <ModalWrapper onClosed={() => {}} minimalStyling />
                    );
                    setVWC(saveError, null);
                    try {
                      await cleanupPriorities();
                    } catch (e) {
                      setVWC(
                        saveError,
                        e instanceof DisplayableError
                          ? e
                          : new DisplayableError('client', 'cleanup priorities', `${e}`)
                      );
                    } finally {
                      closeOverlay();
                    }
                  }}>
                  Cleanup Priorities
                </Button>
              </div>
            )}
          />
        </>
      )}
    </CrudFormElement>
  );
};

const CourseBackground = ({
  course,
  editingVWC,
  newBackgroundVWC,
  imageHandler,
}: {
  course: Course;
  editingVWC: ValueWithCallbacks<boolean>;
  newBackgroundVWC: WritableValueWithCallbacks<CourseBackgroundImage | null>;
  imageHandler: OsehImageStateRequestHandler;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const previewingVWC = useWritableValueWithCallbacks<'original' | 'darkened'>(() => 'original');
  const previewImagesVWC = useWritableValueWithCallbacks<OsehImageState[]>(() => []);

  useValuesWithCallbacksEffect([newBackgroundVWC, windowSizeVWC, previewingVWC], () => {
    const windowSize = windowSizeVWC.get();
    const newBackground = newBackgroundVWC.get();
    const previewing = previewingVWC.get();

    if (newBackground === null) {
      return handleBackgrounds(course.backgroundOriginalImage, course.backgroundDarkenedImage);
    } else {
      return handleBackgrounds(newBackground.originalImageFile, newBackground.darkenedImageFile);
    }

    function handleBackgrounds(original: OsehImageRef | null, darkened: OsehImageRef | null) {
      const bknd = previewing === 'original' ? original : darkened;

      previewImagesVWC.get().splice(0, previewImagesVWC.get().length);
      previewImagesVWC.callbacks.call(undefined);

      let active = true;
      const requests: OsehImageRequestedState[] = [];

      const addRequest = (width: number, height: number) => {
        if (bknd === null) {
          return;
        }
        const req = imageHandler.request({
          uid: bknd.uid,
          jwt: bknd.jwt,
          displayWidth: width,
          displayHeight: height,
          alt: '',
          placeholderColor: '#232323',
        });
        const reqIndex = requests.length;
        requests.push(req);

        previewImagesVWC.get().push(req.state);
        previewImagesVWC.callbacks.call(undefined);

        req.stateChanged.add(() => {
          if (!active) {
            return;
          }
          previewImagesVWC.get()[reqIndex] = req.state;
          previewImagesVWC.callbacks.call(undefined);
        });
      };

      if (windowSize.width < 366) {
        const width = windowSize.width - 24;
        const height = (windowSize.width * 427) / 342;
        addRequest(width, height);
      } else {
        addRequest(180, 225);
      }

      return () => {
        active = false;
        requests.forEach((r) => {
          r.stateChanged.clear();
          r.release();
        });
        requests.splice(0, requests.length);
      };
    }
  });

  const handleChoice = useCallback(
    async (choice: CourseBackgroundImage) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('Not logged in');
      }
      const loginContext = loginContextUnch;
      const response = await apiFetch(
        '/api/1/courses/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            filters: {
              uid: {
                operator: 'neq',
                value: course.uid,
              },
              background_original_image_uid: {
                operator: 'eq',
                value: choice.originalImageFile.uid,
              },
              flags: {
                mutation: {
                  operator: 'and',
                  value: CourseFlags.SERIES_IN_ADMIN_AREA,
                },
                comparison: {
                  operator: 'neq',
                  value: 0,
                },
              },
            },
            limit: 3,
          }),
        },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }
      const raw: { items: any[]; next_page_sort?: any } = await response.json();
      if (raw.items.length === 0) {
        setVWC(newBackgroundVWC, choice);
        return;
      }

      const items = raw.items.map((item) => convertUsingMapper(item, courseKeyMap));
      const confirmation = await showYesNoModal(modalContext.modals, {
        title: 'Reuse background?',
        body:
          'That background is already in use by the following courses: ' +
          items.map((item) => `${item.title} by ${item.instructor.name}`).join(', ') +
          (raw.next_page_sort !== undefined && raw.next_page_sort !== null ? ', and more' : ''),
        cta1: 'Reuse',
        cta2: 'Cancel',
        emphasize: 2,
      }).promise;
      if (confirmation) {
        setVWC(newBackgroundVWC, choice);
      }
    },
    [loginContextRaw.value, modalContext.modals, course.uid, newBackgroundVWC]
  );

  return (
    <CrudFormElement title="Background">
      <RenderGuardedComponent
        props={previewingVWC}
        component={(previewing) => (
          <div className={styles.previewTypeContainer}>
            <select
              className={styles.previewType}
              value={previewing}
              onChange={(e) => setVWC(previewingVWC, e.target.value as 'original' | 'darkened')}>
              <option value="original">Original</option>
              <option value="darkened">Darkened</option>
            </select>
          </div>
        )}
      />
      <div className={styles.backgrounds}>
        <RenderGuardedComponent
          props={previewImagesVWC}
          equalityFn={() => false}
          component={(images) => {
            return (
              <>
                {images.map((image, i) => (
                  <div key={i} className={styles.background}>
                    <OsehImageFromState {...image} />
                  </div>
                ))}
              </>
            );
          }}
        />
      </div>
      <CrudSwappableElement
        version={editingVWC}
        falsey={() => <></>}
        truthy={() => (
          <>
            <div className={styles.chooseOrAddContainer}>
              <div>
                <Button
                  type="button"
                  variant="filled"
                  onClick={async (e) => {
                    e.preventDefault();

                    const choice = await showCourseBackgroundImageUploader(
                      modalContext.modals,
                      loginContextRaw
                    ).promise;

                    if (choice !== undefined) {
                      handleChoice(choice);
                    }
                  }}>
                  Upload
                </Button>
              </div>
              <div>
                <Button
                  type="button"
                  variant="link"
                  onClick={async (e) => {
                    e.preventDefault();
                    const choice = await showCourseBackgroundImageSelector(modalContext.modals)
                      .promise;

                    if (choice !== undefined) {
                      handleChoice(choice);
                    }
                  }}>
                  Choose
                </Button>
              </div>
              <RenderGuardedComponent
                props={newBackgroundVWC}
                component={(newBknd) => (
                  <div>
                    {newBknd !== null && (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setVWC(newBackgroundVWC, null)}>
                        Reset
                      </Button>
                    )}
                  </div>
                )}
              />
            </div>
          </>
        )}
      />
    </CrudFormElement>
  );
};

const CourseHero = ({
  course,
  editingVWC,
  newHeroVWC,
  imageHandler,
}: {
  course: Course;
  editingVWC: ValueWithCallbacks<boolean>;
  newHeroVWC: WritableValueWithCallbacks<CourseHeroImage | null>;
  imageHandler: OsehImageStateRequestHandler;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const previewImagesVWC = useWritableValueWithCallbacks<OsehImageState[]>(() => []);

  useValueWithCallbacksEffect(newHeroVWC, (newHero) => {
    return handleHero(newHero?.imageFile ?? course.heroImage);

    function handleHero(hero: OsehImageRef | null) {
      previewImagesVWC.get().splice(0, previewImagesVWC.get().length);
      previewImagesVWC.callbacks.call(undefined);

      const requests: OsehImageRequestedState[] = [];
      let active = true;

      const addRequest = (width: number, height: number) => {
        if (hero === null) {
          return;
        }
        const req = imageHandler.request({
          uid: hero.uid,
          jwt: hero.jwt,
          displayWidth: width,
          displayHeight: height,
          alt: '',
          placeholderColor: '#232323',
        });
        const reqIndex = requests.length;
        requests.push(req);

        previewImagesVWC.get().push(req.state);
        previewImagesVWC.callbacks.call(undefined);

        req.stateChanged.add(() => {
          if (!active) {
            return;
          }
          previewImagesVWC.get()[reqIndex] = req.state;
          previewImagesVWC.callbacks.call(undefined);
        });
      };

      if (hero !== null) {
        addRequest(180, 180);
        addRequest(180, 135);
      }

      return () => {
        active = false;
        requests.forEach((r) => {
          r.stateChanged.clear();
          r.release();
        });
      };
    }
  });

  const handleChoice = useCallback(
    async (choice: CourseHeroImage) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('Not logged in');
      }
      const loginContext = loginContextUnch;
      const response = await apiFetch(
        '/api/1/courses/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            filters: {
              uid: {
                operator: 'neq',
                value: course.uid,
              },
              hero_image_uid: {
                operator: 'eq',
                value: choice.imageFile.uid,
              },
              flags: {
                mutation: {
                  operator: 'and',
                  value: CourseFlags.SERIES_IN_ADMIN_AREA,
                },
                comparison: {
                  operator: 'neq',
                  value: 0,
                },
              },
            },
            limit: 3,
          }),
        },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }
      const raw: { items: any[]; next_page_sort?: any } = await response.json();
      if (raw.items.length === 0) {
        setVWC(newHeroVWC, choice);
        return;
      }

      const items = raw.items.map((item) => convertUsingMapper(item, courseKeyMap));
      const confirmation = await showYesNoModal(modalContext.modals, {
        title: 'Reuse hero?',
        body:
          'That hero image is already in use by the following courses: ' +
          items.map((item) => `${item.title} by ${item.instructor.name}`).join(', ') +
          (raw.next_page_sort !== undefined && raw.next_page_sort !== null ? ', and more' : ''),
        cta1: 'Reuse',
        cta2: 'Cancel',
        emphasize: 2,
      }).promise;
      if (confirmation) {
        setVWC(newHeroVWC, choice);
      }
    },
    [loginContextRaw.value, modalContext.modals, course.uid, newHeroVWC]
  );

  return (
    <CrudFormElement title="Share Page Image">
      <div className={styles.backgrounds}>
        <RenderGuardedComponent
          props={previewImagesVWC}
          equalityFn={() => false}
          component={(images) => {
            return (
              <>
                {images.map((image, i) => (
                  <div key={i} className={styles.background}>
                    <OsehImageFromState {...image} />
                  </div>
                ))}
              </>
            );
          }}
        />
      </div>
      <CrudSwappableElement
        version={editingVWC}
        falsey={() => <></>}
        truthy={() => (
          <>
            <div className={styles.chooseOrAddContainer}>
              <div>
                <Button
                  type="button"
                  variant="filled"
                  onClick={async (e) => {
                    e.preventDefault();

                    const choice = await showCourseHeroImageUploader(
                      modalContext.modals,
                      loginContextRaw
                    ).promise;

                    if (choice !== undefined) {
                      handleChoice(choice);
                    }
                  }}>
                  Upload
                </Button>
              </div>
              <div>
                <Button
                  type="button"
                  variant="link"
                  onClick={async (e) => {
                    e.preventDefault();
                    const choice = await showCourseHeroImageSelector(modalContext.modals).promise;

                    if (choice !== undefined) {
                      handleChoice(choice);
                    }
                  }}>
                  Choose
                </Button>
              </div>
              <RenderGuardedComponent
                props={newHeroVWC}
                component={(newHero) => (
                  <div>
                    {newHero !== null && (
                      <Button type="button" variant="link" onClick={() => setVWC(newHeroVWC, null)}>
                        Reset
                      </Button>
                    )}
                  </div>
                )}
              />
            </div>
          </>
        )}
      />
    </CrudFormElement>
  );
};

const CourseLogoElement = ({
  course,
  editingVWC,
  newLogoVWC,
  imageHandler,
}: {
  course: Course;
  editingVWC: ValueWithCallbacks<boolean>;
  newLogoVWC: WritableValueWithCallbacks<CourseLogo | null>;
  imageHandler: OsehImageStateRequestHandler;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const previewImagesVWC = useWritableValueWithCallbacks<OsehImageState[]>(() => []);

  useValueWithCallbacksEffect(newLogoVWC, (newLogo) => {
    return handleLogo(newLogo?.imageFile ?? course.logoImage);

    function handleLogo(logo: OsehImageRef | null) {
      previewImagesVWC.get().splice(0, previewImagesVWC.get().length);
      previewImagesVWC.callbacks.call(undefined);

      const requests: OsehImageRequestedState[] = [];
      let active = true;

      const addRequest = (width: number) => {
        if (logo === null) {
          return;
        }
        const req = imageHandler.request({
          uid: logo.uid,
          jwt: logo.jwt,
          displayWidth: width,
          displayHeight: null,
          compareAspectRatio: (a, b) => a.height / a.width - b.height / b.width,
          alt: '',
          placeholderColor: '#232323',
        });
        const reqIndex = requests.length;
        requests.push(req);

        previewImagesVWC.get().push(req.state);
        previewImagesVWC.callbacks.call(undefined);

        req.stateChanged.add(() => {
          if (!active) {
            return;
          }
          previewImagesVWC.get()[reqIndex] = req.state;
          previewImagesVWC.callbacks.call(undefined);
        });
      };

      addRequest(180);

      return () => {
        active = false;
        requests.forEach((r) => {
          r.stateChanged.clear();
          r.release();
        });
      };
    }
  });

  const handleChoice = useCallback(
    async (choice: CourseLogo) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('Not logged in');
      }
      const loginContext = loginContextUnch;
      const response = await apiFetch(
        '/api/1/courses/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            filters: {
              uid: {
                operator: 'neq',
                value: course.uid,
              },
              logo_image_uid: {
                operator: 'eq',
                value: choice.imageFile.uid,
              },
              flags: {
                mutation: {
                  operator: 'and',
                  value: CourseFlags.SERIES_IN_ADMIN_AREA,
                },
                comparison: {
                  operator: 'neq',
                  value: 0,
                },
              },
            },
            limit: 3,
          }),
        },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }
      const raw: { items: any[]; next_page_sort?: any } = await response.json();
      if (raw.items.length === 0) {
        setVWC(newLogoVWC, choice);
        return;
      }

      const items = raw.items.map((item) => convertUsingMapper(item, courseKeyMap));
      const confirmation = await showYesNoModal(modalContext.modals, {
        title: 'Reuse logo?',
        body:
          'That logo is already in use by the following courses: ' +
          items.map((item) => `${item.title} by ${item.instructor.name}`).join(', ') +
          (raw.next_page_sort !== undefined && raw.next_page_sort !== null ? ', and more' : ''),
        cta1: 'Reuse',
        cta2: 'Cancel',
        emphasize: 2,
      }).promise;
      if (confirmation) {
        setVWC(newLogoVWC, choice);
      }
    },
    [loginContextRaw.value, modalContext.modals, course.uid, newLogoVWC]
  );

  return (
    <CrudFormElement title="Logo">
      <div className={styles.logos}>
        <RenderGuardedComponent
          props={previewImagesVWC}
          equalityFn={() => false}
          component={(images) => {
            return (
              <>
                {images.map((image, i) => (
                  <div key={i} className={styles.logo}>
                    <OsehImageFromState {...image} />
                  </div>
                ))}
              </>
            );
          }}
        />
      </div>
      <CrudSwappableElement
        version={editingVWC}
        falsey={() => <></>}
        truthy={() => (
          <>
            <div className={styles.chooseOrAddContainer}>
              <div>
                <Button
                  type="button"
                  variant="filled"
                  onClick={async (e) => {
                    e.preventDefault();

                    const choice = await showCourseLogoUploader(
                      modalContext.modals,
                      loginContextRaw
                    ).promise;

                    if (choice !== undefined) {
                      handleChoice(choice);
                    }
                  }}>
                  Upload
                </Button>
              </div>
              <div>
                <Button
                  type="button"
                  variant="link"
                  onClick={async (e) => {
                    e.preventDefault();
                    const choice = await showCourseLogoSelector(modalContext.modals).promise;

                    if (choice !== undefined) {
                      handleChoice(choice);
                    }
                  }}>
                  Choose
                </Button>
              </div>
              <RenderGuardedComponent
                props={newLogoVWC}
                component={(newLogo) => (
                  <div>
                    {newLogo !== null && (
                      <Button type="button" variant="link" onClick={() => setVWC(newLogoVWC, null)}>
                        Reset
                      </Button>
                    )}
                  </div>
                )}
              />
            </div>
          </>
        )}
      />
    </CrudFormElement>
  );
};

const CourseVideoElement = ({
  course,
  editingVWC,
  newVideoVWC,
  newThumbnailVWC,
}: {
  course: Course;
  editingVWC: ValueWithCallbacks<boolean>;
  newVideoVWC: WritableValueWithCallbacks<CourseVideo | null>;
  newThumbnailVWC: WritableValueWithCallbacks<CourseVideoThumbnail | null>;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);

  const handlePotentialAutoThumbnail = useCallback(
    async (video: CourseVideo) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;

      const response = await apiFetch(
        '/api/1/courses/videos/thumbnails/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            filters: {
              source_video_sha512: {
                operator: 'eq',
                value: video.contentFileOriginalSHA512,
              },
            },
            sort: [],
            limit: 1,
          }),
        },
        loginContext
      );

      const data: { items: any[] } = await response.json();
      if (data.items.length === 0) {
        return;
      }

      const choice = await showYesNoModal(modalContext.modals, {
        title: 'View auto-generated thumbnails?',
        body:
          'A static image is shown when the video is still loading to reduce perceived load times. ' +
          'You can either upload this image yourself or select one of the extracted frames of the video.',
        cta1: 'View',
        cta2: 'Cancel',
        emphasize: 1,
      }).promise;

      if (choice !== true) {
        return;
      }

      const thumbnail = await showCourseVideoThumbnailSelector(modalContext.modals, {
        sourceVideoSHA512: video.contentFileOriginalSHA512,
      }).promise;

      if (thumbnail !== undefined) {
        setVWC(newThumbnailVWC, thumbnail);
      }
    },
    [loginContextRaw.value, modalContext.modals, newThumbnailVWC]
  );

  const handleChoice = useCallback(
    async (choice: CourseVideo) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('Not logged in');
      }
      const loginContext = loginContextUnch;
      const response = await apiFetch(
        '/api/1/courses/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            filters: {
              uid: {
                operator: 'neq',
                value: course.uid,
              },
              video_content_uid: {
                operator: 'eq',
                value: choice.contentFile.uid,
              },
              flags: {
                mutation: {
                  operator: 'and',
                  value: CourseFlags.SERIES_IN_ADMIN_AREA,
                },
                comparison: {
                  operator: 'neq',
                  value: 0,
                },
              },
            },
            limit: 3,
          }),
        },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }
      const raw: { items: any[]; next_page_sort?: any } = await response.json();
      if (raw.items.length === 0) {
        setVWC(newVideoVWC, choice);
        await handlePotentialAutoThumbnail(choice);
        return;
      }

      const items = raw.items.map((item) => convertUsingMapper(item, courseKeyMap));
      const confirmation = await showYesNoModal(modalContext.modals, {
        title: 'Reuse video?',
        body:
          'That video is already in use by the following courses: ' +
          items.map((item) => `${item.title} by ${item.instructor.name}`).join(', ') +
          (raw.next_page_sort !== undefined && raw.next_page_sort !== null ? ', and more' : ''),
        cta1: 'Reuse',
        cta2: 'Cancel',
        emphasize: 2,
      }).promise;
      if (confirmation) {
        setVWC(newVideoVWC, choice);
        await handlePotentialAutoThumbnail(choice);
      }
    },
    [
      loginContextRaw.value,
      modalContext.modals,
      course.uid,
      newVideoVWC,
      handlePotentialAutoThumbnail,
    ]
  );

  return (
    <CrudFormElement title="Video">
      <div className={styles.backgrounds}>
        <RenderGuardedComponent
          props={newVideoVWC}
          equalityFn={() => false}
          component={(newVideo) => {
            const contentFile = newVideo?.contentFile ?? course.videoContent;
            if (contentFile === null) {
              return <></>;
            }
            return (
              <OsehContent
                uid={contentFile.uid}
                jwt={contentFile.jwt}
                showAs="video"
                targetComparer={createVideoSizeComparerForTarget(180, 320)}
              />
            );
          }}
        />
      </div>
      <CrudSwappableElement
        version={editingVWC}
        falsey={() => <></>}
        truthy={() => (
          <>
            <div className={styles.chooseOrAddContainer}>
              <div>
                <Button
                  type="button"
                  variant="filled"
                  onClick={async (e) => {
                    e.preventDefault();

                    const choice = await showCourseVideoUploader(
                      modalContext.modals,
                      loginContextRaw
                    ).promise;

                    if (choice !== undefined) {
                      await handleChoice(choice);
                    }
                  }}>
                  Upload
                </Button>
              </div>
              <div>
                <Button
                  type="button"
                  variant="link"
                  onClick={async (e) => {
                    e.preventDefault();
                    const choice = await showCourseVideoSelector(modalContext.modals).promise;

                    if (choice !== undefined) {
                      await handleChoice(choice);
                    }
                  }}>
                  Choose
                </Button>
              </div>
              <RenderGuardedComponent
                props={newVideoVWC}
                component={(newVideo) => (
                  <div>
                    {newVideo !== null && (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setVWC(newVideoVWC, null)}>
                        Reset
                      </Button>
                    )}
                  </div>
                )}
              />
            </div>
          </>
        )}
      />
    </CrudFormElement>
  );
};

const CourseVideoThumbnailElement = ({
  course,
  editingVWC,
  newVideoThumbnailVWC,
  imageHandler,
}: {
  course: Course;
  editingVWC: ValueWithCallbacks<boolean>;
  newVideoThumbnailVWC: WritableValueWithCallbacks<CourseVideoThumbnail | null>;
  imageHandler: OsehImageStateRequestHandler;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const previewImagesVWC = useWritableValueWithCallbacks<OsehImageState[]>(() => []);

  useValueWithCallbacksEffect(newVideoThumbnailVWC, (newThumbnail) => {
    return handleThumbnail(newThumbnail?.imageFile ?? course.videoThumbnail);

    function handleThumbnail(hero: OsehImageRef | null) {
      previewImagesVWC.get().splice(0, previewImagesVWC.get().length);
      previewImagesVWC.callbacks.call(undefined);

      const requests: OsehImageRequestedState[] = [];
      let active = true;

      const addRequest = (width: number, height: number) => {
        if (hero === null) {
          return;
        }
        const req = imageHandler.request({
          uid: hero.uid,
          jwt: hero.jwt,
          displayWidth: width,
          displayHeight: height,
          alt: '',
          placeholderColor: '#232323',
        });
        const reqIndex = requests.length;
        requests.push(req);

        previewImagesVWC.get().push(req.state);
        previewImagesVWC.callbacks.call(undefined);

        req.stateChanged.add(() => {
          if (!active) {
            return;
          }
          previewImagesVWC.get()[reqIndex] = req.state;
          previewImagesVWC.callbacks.call(undefined);
        });
      };

      if (hero !== null) {
        addRequest(180, 368);
        addRequest(480, 270);
      }

      return () => {
        active = false;
        requests.forEach((r) => {
          r.stateChanged.clear();
          r.release();
        });
      };
    }
  });

  const handleChoice = useCallback(
    async (choice: CourseVideoThumbnail) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('Not logged in');
      }
      const loginContext = loginContextUnch;
      const response = await apiFetch(
        '/api/1/courses/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            filters: {
              uid: {
                operator: 'neq',
                value: course.uid,
              },
              video_thumbnail_image_uid: {
                operator: 'eq',
                value: choice.imageFile.uid,
              },
              flags: {
                mutation: {
                  operator: 'and',
                  value: CourseFlags.SERIES_IN_ADMIN_AREA,
                },
                comparison: {
                  operator: 'neq',
                  value: 0,
                },
              },
            },
            limit: 3,
          }),
        },
        loginContext
      );
      if (!response.ok) {
        throw response;
      }
      const raw: { items: any[]; next_page_sort?: any } = await response.json();
      if (raw.items.length === 0) {
        setVWC(newVideoThumbnailVWC, choice);
        return;
      }

      const items = raw.items.map((item) => convertUsingMapper(item, courseKeyMap));
      const confirmation = await showYesNoModal(modalContext.modals, {
        title: 'Reuse logo?',
        body:
          'That thumbnail is already in use by the following courses: ' +
          items.map((item) => `${item.title} by ${item.instructor.name}`).join(', ') +
          (raw.next_page_sort !== undefined && raw.next_page_sort !== null ? ', and more' : ''),
        cta1: 'Reuse',
        cta2: 'Cancel',
        emphasize: 2,
      }).promise;
      if (confirmation) {
        setVWC(newVideoThumbnailVWC, choice);
      }
    },
    [loginContextRaw.value, modalContext.modals, course.uid, newVideoThumbnailVWC]
  );

  return (
    <CrudFormElement title="Thumbnail">
      <div className={styles.backgrounds}>
        <RenderGuardedComponent
          props={previewImagesVWC}
          equalityFn={() => false}
          component={(images) => {
            return (
              <>
                {images.map((image, i) => (
                  <div key={i} className={styles.background}>
                    <OsehImageFromState {...image} />
                  </div>
                ))}
              </>
            );
          }}
        />
      </div>
      <CrudSwappableElement
        version={editingVWC}
        falsey={() => <></>}
        truthy={() => (
          <>
            <div className={styles.chooseOrAddContainer}>
              <div>
                <Button
                  type="button"
                  variant="filled"
                  onClick={async (e) => {
                    e.preventDefault();

                    const choice = await showCourseVideoThumbnailUploader(
                      modalContext.modals,
                      loginContextRaw
                    ).promise;

                    if (choice !== undefined) {
                      handleChoice(choice);
                    }
                  }}>
                  Upload
                </Button>
              </div>
              <div>
                <Button
                  type="button"
                  variant="link"
                  onClick={async (e) => {
                    e.preventDefault();
                    const choice = await showCourseVideoThumbnailSelector(modalContext.modals)
                      .promise;

                    if (choice !== undefined) {
                      handleChoice(choice);
                    }
                  }}>
                  Choose
                </Button>
              </div>
              <RenderGuardedComponent
                props={newVideoThumbnailVWC}
                component={(newThumb) => (
                  <div>
                    {newThumb !== null && (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setVWC(newVideoThumbnailVWC, null)}>
                        Reset
                      </Button>
                    )}
                  </div>
                )}
              />
            </div>
          </>
        )}
      />
    </CrudFormElement>
  );
};

const CourseFlagsElement = ({
  course,
  editingVWC,
  newFlagsVWC,
}: {
  course: Course;
  editingVWC: ValueWithCallbacks<boolean>;
  newFlagsVWC: WritableValueWithCallbacks<CourseFlags>;
}): ReactElement => {
  return (
    <CrudFormElement title="Flags">
      <CrudSwappableElement
        version={editingVWC}
        falsey={() => (
          <ul className={styles.flags}>
            {FLAG_NAMES.map(([flags, name]) => {
              if ((flags & course.flags) !== 0) {
                return (
                  <li key={flags} className={styles.flag}>
                    {name}
                  </li>
                );
              } else {
                return <Fragment key={flags}></Fragment>;
              }
            })}
          </ul>
        )}
        truthy={() => (
          <RenderGuardedComponent
            props={newFlagsVWC}
            component={(newFlags) => (
              <div className={styles.editFlags}>
                {FLAG_NAMES.map(([flags, name]) => (
                  <Checkbox
                    key={flags}
                    value={(newFlags & flags) !== 0}
                    setValue={(v) => {
                      setVWC(newFlagsVWC, v ? newFlags | flags : newFlags & ~flags);
                    }}
                    label={name}
                  />
                ))}
              </div>
            )}
          />
        )}
      />
    </CrudFormElement>
  );
};
