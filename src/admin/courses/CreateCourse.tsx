import { ReactElement, useCallback, useContext } from 'react';
import { Course, courseKeyMap } from './Course';
import styles from './CreateCourse.module.css';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { TextInput } from '../../shared/forms/TextInput';
import { adaptValueWithCallbacksAsSetState } from '../../shared/lib/adaptValueWithCallbacksAsSetState';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../shared/lib/setVWC';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { COURSE_FLAG_PRESETS_REVERSE_MAP } from './flags/CourseFlagPresets';
import { CourseFlags } from './flags/CourseFlags';
import { FLAG_NAMES } from './CourseFilterAndSortBlock';
import { Checkbox } from '../../shared/forms/Checkbox';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { Button } from '../../shared/forms/Button';
import { Instructor } from '../instructors/Instructor';
import { InstructorPicker } from '../instructors/InstructorPicker';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { OsehImage } from '../../shared/images/OsehImage';
import { CourseBackgroundImage } from './background_images/CourseBackgroundImage';
import { convertUsingMapper } from '../crud/CrudFetcher';
import { showYesNoModal } from '../../shared/lib/showYesNoModal';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { showCourseBackgroundImageSelector } from './background_images/showCourseBackgroundImageSelector';
import { showCourseBackgroundImageUploader } from './background_images/showCourseBackgroundImageUploader';
import { CourseHeroImage } from './hero_images/CourseHeroImage';
import { showCourseHeroImageUploader } from './hero_images/showCourseHeroImageUploader';
import { showCourseHeroImageSelector } from './hero_images/showCourseHeroImageSelector';
import { CourseLogo } from './logos/CourseLogo';
import { combineClasses } from '../../shared/lib/combineClasses';
import { showCourseLogoUploader } from './logos/showCourseLogoUploader';
import { showCourseLogoSelector } from './logos/showCourseLogoSelector';
import { CourseVideo } from './videos/CourseVideo';
import { CourseVideoThumbnail } from './videos/thumbnails/CourseVideoThumbnail';
import { showCourseVideoThumbnailSelector } from './videos/thumbnails/showCourseVideoThumbnailSelector';
import { OsehContent } from '../../shared/content/OsehContent';
import { createVideoSizeComparerForTarget } from '../../shared/content/createVideoSizeComparerForTarget';
import { showCourseVideoSelector } from './videos/showCourseVideoSelector';
import { showCourseVideoUploader } from './videos/showCourseVideoUploader';
import { showCourseVideoThumbnailUploader } from './videos/thumbnails/showCourseVideoThumbnailUploader';
import { ErrorBlock, describeError } from '../../shared/forms/ErrorBlock';

type CreateCourseProps = {
  /**
   * Called after a course is created by the user
   * @param course The course that was created
   */
  onCreated: (this: void, course: Course) => void;
};

/**
 * Shows a block where the user can create a new course.
 */
export const CreateCourse = ({ onCreated }: CreateCourseProps): ReactElement => {
  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);
  const slugVWC = useWritableValueWithCallbacks(() => '');
  const slugValidVWC = useWritableValueWithCallbacks<boolean | null>(() => false);
  const imageHandler = useOsehImageStateRequestHandler({});

  useValueWithCallbacksEffect(slugVWC, (slug) => {
    const clientSideValid = slug.length > 0 && slug.length <= 100 && /^[a-z0-9-]+$/.test(slug);
    if (!clientSideValid) {
      setVWC(slugValidVWC, false);
      return undefined;
    }

    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      setVWC(slugValidVWC, null);
      return;
    }
    const loginContext = loginContextUnch;

    let active = true;
    const controller = window.AbortController ? new window.AbortController() : undefined;
    const signal = controller ? controller.signal : undefined;
    checkValid();
    return () => {
      active = false;
      controller?.abort();
    };

    async function checkValid() {
      if (!active) {
        return;
      }
      setVWC(slugValidVWC, null);

      const response = await apiFetch(
        '/api/1/courses/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            filters: {
              slug: {
                operator: 'eq',
                value: slug,
              },
            },
            limit: 1,
          }),
          signal,
        },
        loginContext
      );

      if (!active) {
        return;
      }

      if (!response.ok) {
        throw response;
      }

      const data: { items: any[] } = await response.json();
      if (!active) {
        return;
      }
      setVWC(slugValidVWC, data.items.length === 0);
    }
  });

  const slugInfoVWC = useMappedValuesWithCallbacks([slugVWC, slugValidVWC], () => ({
    slug: slugVWC.get(),
    valid: slugValidVWC.get(),
  }));

  const flagsVWC = useWritableValueWithCallbacks<CourseFlags | 0>(
    () => COURSE_FLAG_PRESETS_REVERSE_MAP.get('Premium') ?? 0
  );
  const revenueCatEntitlementVWC = useWritableValueWithCallbacks(() => 'pro');
  const revenueCatEntitlementValidVWC = useMappedValueWithCallbacks(
    revenueCatEntitlementVWC,
    (v): boolean | null => {
      const clientSideValid = v.length > 0 && v.length <= 100 && /^[a-z0-9-]+$/.test(v);
      if (!clientSideValid) {
        return false;
      }

      if (v === 'pro') {
        return true;
      }
      return null;
    }
  );
  const revenueCatEntitlementInfoVWC = useMappedValuesWithCallbacks(
    [revenueCatEntitlementVWC, revenueCatEntitlementValidVWC],
    () => ({
      entitlement: revenueCatEntitlementVWC.get(),
      valid: revenueCatEntitlementValidVWC.get(),
    })
  );

  const titleVWC = useWritableValueWithCallbacks(() => '');
  const titleValidVWC = useMappedValueWithCallbacks(
    titleVWC,
    (v) => v.length > 0 && v.length <= 100
  );
  const titleInfoVWC = useMappedValuesWithCallbacks([titleVWC, titleValidVWC], () => ({
    title: titleVWC.get(),
    valid: titleValidVWC.get(),
  }));

  const descriptionVWC = useWritableValueWithCallbacks(() => '');
  const descriptionValidVWC = useMappedValueWithCallbacks(
    descriptionVWC,
    (v) => v.length > 0 && v.length <= 500
  );
  const descriptionInfoVWC = useMappedValuesWithCallbacks(
    [descriptionVWC, descriptionValidVWC],
    () => ({
      description: descriptionVWC.get(),
      valid: descriptionValidVWC.get(),
    })
  );

  const instructorQueryVWC = useWritableValueWithCallbacks<string>(() => '');
  const instructorVWC = useWritableValueWithCallbacks<Instructor | null>(() => null);
  const instructorValidVWC = useMappedValueWithCallbacks(instructorVWC, (v) => v !== null);

  const backgroundImageVWC = useWritableValueWithCallbacks<CourseBackgroundImage | null>(
    () => null
  );
  const backgroundImageValidVWC = useMappedValueWithCallbacks(
    backgroundImageVWC,
    (v) => v !== null
  );

  const handleBackgroundChoice = useCallback(
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
        setVWC(backgroundImageVWC, choice);
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
        setVWC(backgroundImageVWC, choice);
      }
    },
    [loginContextRaw.value, modalContext.modals, backgroundImageVWC]
  );

  const heroImageVWC = useWritableValueWithCallbacks<CourseHeroImage | null>(() => null);
  const heroImageValidVWC = useMappedValueWithCallbacks(heroImageVWC, (v) => v !== null);

  const handleHeroChoice = useCallback(
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
        setVWC(heroImageVWC, choice);
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
        setVWC(heroImageVWC, choice);
      }
    },
    [loginContextRaw.value, modalContext.modals, heroImageVWC]
  );

  const logoVWC = useWritableValueWithCallbacks<CourseLogo | null>(() => null);
  const logoValidVWC = useMappedValueWithCallbacks(logoVWC, (v) => v !== null);

  const handleLogoChoice = useCallback(
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
        setVWC(logoVWC, choice);
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
        setVWC(logoVWC, choice);
      }
    },
    [loginContextRaw.value, modalContext.modals, logoVWC]
  );

  const videoVWC = useWritableValueWithCallbacks<CourseVideo | null>(() => null);
  const videoValidVWC = useMappedValueWithCallbacks(videoVWC, (v) => v !== null);

  const thumbnailVWC = useWritableValueWithCallbacks<CourseVideoThumbnail | null>(() => null);
  const thumbnailValidVWC = useMappedValueWithCallbacks(thumbnailVWC, (v) => v !== null);

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
        setVWC(thumbnailVWC, thumbnail);
      }
    },
    [loginContextRaw.value, modalContext.modals, thumbnailVWC]
  );

  const handleVideoChoice = useCallback(
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
        setVWC(videoVWC, choice);
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
        setVWC(videoVWC, choice);
        await handlePotentialAutoThumbnail(choice);
      }
    },
    [loginContextRaw.value, modalContext.modals, videoVWC, handlePotentialAutoThumbnail]
  );

  const handleThumbnailChoice = useCallback(
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
        setVWC(thumbnailVWC, choice);
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
        setVWC(thumbnailVWC, choice);
      }
    },
    [loginContextRaw.value, modalContext.modals, thumbnailVWC]
  );

  const savingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  const validVWC = useMappedValuesWithCallbacks(
    [
      slugValidVWC,
      revenueCatEntitlementValidVWC,
      titleValidVWC,
      descriptionValidVWC,
      instructorValidVWC,
      backgroundImageValidVWC,
      heroImageValidVWC,
      logoValidVWC,
      videoValidVWC,
      thumbnailValidVWC,
      savingVWC,
    ],
    (): boolean => {
      const slugValid = !!slugValidVWC.get();
      const revenueCatEntitlementValid = revenueCatEntitlementValidVWC.get() !== false;
      const titleValid = titleValidVWC.get();
      const descriptionValid = descriptionValidVWC.get();
      const instructorValid = instructorValidVWC.get();
      const backgroundImageValid = backgroundImageValidVWC.get();
      const heroImageValid = heroImageValidVWC.get();
      const logoValid = logoValidVWC.get();
      const videoValid = videoValidVWC.get();
      const thumbnailValid = thumbnailValidVWC.get();
      const saving = savingVWC.get();
      return (
        slugValid &&
        revenueCatEntitlementValid &&
        titleValid &&
        descriptionValid &&
        instructorValid &&
        backgroundImageValid &&
        heroImageValid &&
        logoValid &&
        videoValid &&
        thumbnailValid &&
        !saving
      );
    }
  );

  const create = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      throw new Error('Not logged in');
    }
    const loginContext = loginContextUnch;

    const response = await apiFetch(
      '/api/1/courses/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          slug: slugVWC.get(),
          flags: flagsVWC.get(),
          revenue_cat_entitlement: revenueCatEntitlementVWC.get(),
          title: titleVWC.get(),
          description: descriptionVWC.get(),
          instructor_uid: instructorVWC.get()!.uid,
          background_image_uid: backgroundImageVWC.get()!.uid,
          video_uid: videoVWC.get()!.uid,
          video_thumbnail_uid: thumbnailVWC.get()!.uid,
          logo_uid: logoVWC.get()!.uid,
          hero_uid: heroImageVWC.get()!.uid,
        }),
      },
      loginContext
    );

    if (!response.ok) {
      throw response;
    }

    const raw = await response.json();
    const parsed = convertUsingMapper(raw, courseKeyMap);
    onCreated(parsed);
    setVWC(slugVWC, '');
    setVWC(flagsVWC, COURSE_FLAG_PRESETS_REVERSE_MAP.get('Premium') ?? 0);
    setVWC(revenueCatEntitlementVWC, 'pro');
    setVWC(titleVWC, '');
    setVWC(descriptionVWC, '');
    setVWC(instructorVWC, null);
    setVWC(backgroundImageVWC, null);
    setVWC(heroImageVWC, null);
    setVWC(logoVWC, null);
    setVWC(videoVWC, null);
    setVWC(thumbnailVWC, null);
  }, [
    loginContextRaw.value,
    onCreated,
    slugVWC,
    flagsVWC,
    revenueCatEntitlementVWC,
    titleVWC,
    descriptionVWC,
    instructorVWC,
    backgroundImageVWC,
    heroImageVWC,
    logoVWC,
    videoVWC,
    thumbnailVWC,
  ]);

  return (
    <CrudCreateBlock>
      <form className={styles.form}>
        <RenderGuardedComponent
          props={titleInfoVWC}
          component={({ title, valid }) => (
            <TextInput
              label="Title"
              type="text"
              value={title}
              inputStyle={valid === null ? 'normal' : valid ? 'success' : 'error'}
              onChange={adaptValueWithCallbacksAsSetState(titleVWC)}
              disabled={false}
              help="The title of this course"
              html5Validation={{
                required: true,
                minLength: 1,
                maxLength: 100,
                pattern: '[a-z0-9-]+',
              }}
            />
          )}
          applyInstantly
        />
        <RenderGuardedComponent
          props={slugInfoVWC}
          component={({ slug, valid }) => (
            <TextInput
              label="Slug"
              type="text"
              value={slug}
              inputStyle={valid === null ? 'normal' : valid ? 'success' : 'error'}
              onChange={adaptValueWithCallbacksAsSetState(slugVWC)}
              disabled={false}
              help="The URL-friendly name of the course"
              html5Validation={{
                required: true,
                minLength: 1,
                maxLength: 100,
                pattern: '[a-z0-9-]+',
              }}
            />
          )}
          applyInstantly
        />
        <CrudFormElement title="Instructor">
          <div className={styles.instructorOuterContainer}>
            <RenderGuardedComponent
              props={instructorVWC}
              component={(instructor) =>
                instructor === null ? (
                  <></>
                ) : (
                  <div className={styles.instructorContainer}>
                    {instructor.picture && (
                      <div className={styles.instructorPictureContainer}>
                        <OsehImage
                          uid={instructor.picture.uid}
                          jwt={instructor.picture.jwt}
                          displayWidth={60}
                          displayHeight={60}
                          alt=""
                          handler={imageHandler}
                        />
                      </div>
                    )}
                    <div className={styles.instructorNameContainer}>{instructor.name}</div>
                  </div>
                )
              }
            />
            <RenderGuardedComponent
              props={instructorQueryVWC}
              component={(query) => (
                <InstructorPicker
                  query={query}
                  setQuery={adaptValueWithCallbacksAsSetState(instructorQueryVWC)}
                  setSelected={(v) => {
                    setVWC(instructorQueryVWC, '');
                    setVWC(instructorVWC, v);
                  }}
                  imageHandler={imageHandler}
                />
              )}
              applyInstantly
            />
          </div>
        </CrudFormElement>
        <RenderGuardedComponent
          props={descriptionInfoVWC}
          component={({ description, valid }) => (
            <TextInput
              label="Description"
              type="text"
              value={description}
              inputStyle={valid === null ? 'normal' : valid ? 'success' : 'error'}
              onChange={adaptValueWithCallbacksAsSetState(descriptionVWC)}
              disabled={false}
              help="About 400 characters describing the course. Write outside and paste in. Newlines are not supported."
              html5Validation={{
                required: true,
                minLength: 1,
                maxLength: 1024,
                pattern: '[a-z0-9-]+',
              }}
            />
          )}
          applyInstantly
        />
        <CrudFormElement title="Background Image">
          <div className={styles.imageContainer}>
            <RenderGuardedComponent
              props={backgroundImageVWC}
              component={(v) =>
                v === null ? (
                  <></>
                ) : (
                  <div className={styles.previewsContainer}>
                    <div className={styles.previewContainer}>
                      <OsehImage
                        uid={v.originalImageFile.uid}
                        jwt={v.originalImageFile.jwt}
                        displayWidth={180}
                        displayHeight={225}
                        alt=""
                        handler={imageHandler}
                      />
                    </div>
                  </div>
                )
              }
            />
            <div className={styles.imageControls}>
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
                    handleBackgroundChoice(choice);
                  }
                }}>
                Upload
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={async (e) => {
                  e.preventDefault();
                  const choice = await showCourseBackgroundImageSelector(modalContext.modals)
                    .promise;

                  if (choice !== undefined) {
                    handleBackgroundChoice(choice);
                  }
                }}>
                Choose
              </Button>
            </div>
          </div>
        </CrudFormElement>
        <CrudFormElement title="Share Page Image">
          <div className={styles.imageContainer}>
            <RenderGuardedComponent
              props={heroImageVWC}
              component={(v) =>
                v === null ? (
                  <></>
                ) : (
                  <div className={styles.previewsContainer}>
                    <div className={styles.previewContainer}>
                      <OsehImage
                        uid={v.imageFile.uid}
                        jwt={v.imageFile.jwt}
                        displayWidth={180}
                        displayHeight={180}
                        alt=""
                        handler={imageHandler}
                      />
                    </div>
                    <div className={styles.previewContainer}>
                      <OsehImage
                        uid={v.imageFile.uid}
                        jwt={v.imageFile.jwt}
                        displayWidth={180}
                        displayHeight={135}
                        alt=""
                        handler={imageHandler}
                      />
                    </div>
                  </div>
                )
              }
            />
            <div className={styles.imageControls}>
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
                    handleHeroChoice(choice);
                  }
                }}>
                Upload
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={async (e) => {
                  e.preventDefault();
                  const choice = await showCourseHeroImageSelector(modalContext.modals).promise;

                  if (choice !== undefined) {
                    handleHeroChoice(choice);
                  }
                }}>
                Choose
              </Button>
            </div>
          </div>
        </CrudFormElement>
        <CrudFormElement title="Logo">
          <div className={styles.imageContainer}>
            <RenderGuardedComponent
              props={logoVWC}
              component={(v) =>
                v === null ? (
                  <></>
                ) : (
                  <div className={styles.previewsContainer}>
                    <div
                      className={combineClasses(
                        styles.previewContainer,
                        styles.previewLogoContainer
                      )}>
                      <OsehImage
                        uid={v.imageFile.uid}
                        jwt={v.imageFile.jwt}
                        displayWidth={180}
                        displayHeight={null}
                        compareAspectRatio={(a, b) => a.height / a.width - b.height / b.width}
                        alt=""
                        handler={imageHandler}
                      />
                    </div>
                  </div>
                )
              }
            />
            <div className={styles.imageControls}>
              <Button
                type="button"
                variant="filled"
                onClick={async (e) => {
                  e.preventDefault();

                  const choice = await showCourseLogoUploader(modalContext.modals, loginContextRaw)
                    .promise;

                  if (choice !== undefined) {
                    handleLogoChoice(choice);
                  }
                }}>
                Upload
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={async (e) => {
                  e.preventDefault();
                  const choice = await showCourseLogoSelector(modalContext.modals).promise;

                  if (choice !== undefined) {
                    handleLogoChoice(choice);
                  }
                }}>
                Choose
              </Button>
            </div>
          </div>
        </CrudFormElement>
        <CrudFormElement title="Video">
          <div className={styles.imageContainer}>
            <RenderGuardedComponent
              props={videoVWC}
              component={(v) =>
                v === null ? (
                  <></>
                ) : (
                  <div className={styles.previewsContainer}>
                    <div className={styles.previewContainer}>
                      <OsehContent
                        uid={v.contentFile.uid}
                        jwt={v.contentFile.jwt}
                        targetComparer={createVideoSizeComparerForTarget(180, 320)}
                        showAs="video"
                      />
                    </div>
                  </div>
                )
              }
            />
            <div className={styles.imageControls}>
              <Button
                type="button"
                variant="filled"
                onClick={async (e) => {
                  e.preventDefault();

                  const choice = await showCourseVideoUploader(modalContext.modals, loginContextRaw)
                    .promise;

                  if (choice !== undefined) {
                    handleVideoChoice(choice);
                  }
                }}>
                Upload
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={async (e) => {
                  e.preventDefault();
                  const choice = await showCourseVideoSelector(modalContext.modals).promise;

                  if (choice !== undefined) {
                    handleVideoChoice(choice);
                  }
                }}>
                Choose
              </Button>
            </div>
          </div>
        </CrudFormElement>
        <CrudFormElement title="Video Thumbnail / Cover">
          <div className={styles.imageContainer}>
            <RenderGuardedComponent
              props={thumbnailVWC}
              component={(v) =>
                v === null ? (
                  <></>
                ) : (
                  <div className={styles.previewsContainer}>
                    <div className={styles.previewContainer}>
                      <OsehImage
                        uid={v.imageFile.uid}
                        jwt={v.imageFile.jwt}
                        displayWidth={180}
                        displayHeight={368}
                        alt=""
                        handler={imageHandler}
                      />
                    </div>
                    <div className={styles.previewContainer}>
                      <OsehImage
                        uid={v.imageFile.uid}
                        jwt={v.imageFile.jwt}
                        displayWidth={270}
                        displayHeight={480}
                        alt=""
                        handler={imageHandler}
                      />
                    </div>
                    <div className={styles.previewContainer}>
                      <OsehImage
                        uid={v.imageFile.uid}
                        jwt={v.imageFile.jwt}
                        displayWidth={480}
                        displayHeight={270}
                        alt=""
                        handler={imageHandler}
                      />
                    </div>
                  </div>
                )
              }
            />
            <div className={styles.imageControls}>
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
                    handleThumbnailChoice(choice);
                  }
                }}>
                Upload
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={async (e) => {
                  e.preventDefault();
                  const choice = await showCourseVideoThumbnailSelector(modalContext.modals)
                    .promise;

                  if (choice !== undefined) {
                    handleThumbnailChoice(choice);
                  }
                }}>
                Choose
              </Button>
            </div>
          </div>
        </CrudFormElement>
        <CrudFormElement title="Flags">
          <RenderGuardedComponent
            props={flagsVWC}
            component={(newFlags) => (
              <div className={styles.editFlags}>
                {FLAG_NAMES.map(([flags, name]) => (
                  <Checkbox
                    key={flags}
                    value={(newFlags & flags) !== 0}
                    setValue={(v) => {
                      setVWC(flagsVWC, v ? newFlags | flags : newFlags & ~flags);
                    }}
                    label={name}
                  />
                ))}
              </div>
            )}
          />
        </CrudFormElement>
        <RenderGuardedComponent
          props={revenueCatEntitlementInfoVWC}
          component={({ entitlement, valid }) => (
            <TextInput
              label="RevenueCat Entitlement"
              type="text"
              value={entitlement}
              inputStyle={valid === null ? 'normal' : valid ? 'success' : 'error'}
              onChange={adaptValueWithCallbacksAsSetState(revenueCatEntitlementVWC)}
              disabled={false}
              help="The RevenueCat entitlement identifier required to access this course"
              html5Validation={{
                required: true,
                minLength: 1,
                maxLength: 100,
                pattern: '[a-z0-9-]+',
              }}
            />
          )}
          applyInstantly
        />
        <RenderGuardedComponent
          props={errorVWC}
          component={(error) => (error === null ? <></> : <ErrorBlock>{error}</ErrorBlock>)}
        />
        <RenderGuardedComponent
          props={validVWC}
          component={(valid) => (
            <Button
              type="submit"
              disabled={!valid}
              onClick={async (e) => {
                e.preventDefault();

                setVWC(savingVWC, true);
                setVWC(errorVWC, null);
                try {
                  await create();
                } catch (e) {
                  setVWC(errorVWC, await describeError(e));
                } finally {
                  setVWC(savingVWC, false);
                }
              }}>
              Create
            </Button>
          )}
        />
      </form>
    </CrudCreateBlock>
  );
};
