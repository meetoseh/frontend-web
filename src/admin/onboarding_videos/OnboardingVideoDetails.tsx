import { ReactElement, useCallback, useContext, useEffect } from 'react';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import {
  OnboardingVideo,
  OnboardingVideoPurpose,
  areOnboardingVideoPurposesEqual,
  onboardingVideoKeyMap,
} from './OnboardingVideo';
import styles from './OnboardingVideoDetails.module.css';
import iconStyles from '../crud/icons.module.css';
import { LoginContext } from '../../shared/contexts/LoginContext';
import {
  OnboardingVideoUpload,
  onboardingVideoUploadKeyMap,
} from './uploads/OnboardingVideoUpload';
import { setVWC } from '../../shared/lib/setVWC';
import { OnboardingVideoThumbnail } from './thumbnails/OnboardingVideoThumbnail';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingMapper } from '../crud/CrudFetcher';
import { ErrorBlock, describeError } from '../../shared/forms/ErrorBlock';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { IconButton } from '../../shared/forms/IconButton';
import { showYesNoModal } from '../../shared/lib/showYesNoModal';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { CrudSwappableElement } from '../lib/CrudSwappableElement';
import { CrudFormElement } from '../crud/CrudFormElement';
import { ISO639_1_Options, useLanguagesNR } from '../../shared/components/ISO639_1_Options';
import { OsehContentRef } from '../../shared/content/OsehContentRef';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { OsehContent } from '../../shared/content/OsehContent';
import { createVideoSizeComparerForTarget } from '../../shared/content/createVideoSizeComparerForTarget';
import { Button } from '../../shared/forms/Button';
import { showOnboardingVideoUploader } from './uploads/showOnboardingVideoUploader';
import { showOnboardingVideoSelector } from './uploads/showOnboardingVideoSelector';
import { OsehImage } from '../../shared/images/OsehImage';
import { showOnboardingVideoThumbnailUploader } from './thumbnails/showOnboardingVideoThumbnailUploader';
import { showOnboardingVideoThumbnailSelector } from './thumbnails/showOnboardingVideoThumbnailSelector';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { OsehImageRef } from '../../shared/images/OsehImageRef';
import { Checkbox } from '../../shared/forms/Checkbox';

type OnboardingVideoDetailsProps = {
  /**
   * The onboarding video to display
   */
  onboardingVideo: OnboardingVideo;

  /**
   * Used to update the onboarding video after a confirmation from the server
   */
  setOnboardingVideo: (this: void, onboardingVideo: OnboardingVideo) => void;

  /**
   * The handler for loading images
   */
  imageHandler: OsehImageStateRequestHandler;

  /**
   * Can be called to trigger a save. Primarily intended for when saving is
   * suppressed because we prompted confirmation from the user because there
   * were going to be other things impacted.
   */
  saveIfNecessaryVWC: WritableValueWithCallbacks<() => Promise<void>>;

  /**
   * Can be set to guard against closing the modal while a save is in progress
   */
  editingVWC: WritableValueWithCallbacks<boolean>;
};

/**
 * Used to allow patching the onboarding video
 */
export const OnboardingVideoDetails = ({
  onboardingVideo,
  setOnboardingVideo,
  imageHandler,
  saveIfNecessaryVWC,
  editingVWC,
}: OnboardingVideoDetailsProps): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const savingVWC = useWritableValueWithCallbacks(() => false);
  const newPurposeVWC = useWritableValueWithCallbacks(() => onboardingVideo.purpose);
  const newVideoVWC = useWritableValueWithCallbacks<OnboardingVideoUpload | null>(() => null);
  const newThumbnailVWC = useWritableValueWithCallbacks<OnboardingVideoThumbnail | null>(
    () => null
  );
  const newIsActiveVWC = useWritableValueWithCallbacks(() => onboardingVideo.activeAt !== null);
  const newVisibleInAdminVWC = useWritableValueWithCallbacks(() => onboardingVideo.visibleInAdmin);

  useEffect(() => {
    setVWC(errorVWC, null);
    setVWC(newPurposeVWC, onboardingVideo.purpose);
    setVWC(newVideoVWC, null);
    setVWC(newThumbnailVWC, null);
    setVWC(newIsActiveVWC, onboardingVideo.activeAt !== null);
    setVWC(newVisibleInAdminVWC, onboardingVideo.visibleInAdmin);
  }, [
    onboardingVideo,
    errorVWC,
    newPurposeVWC,
    newVideoVWC,
    newThumbnailVWC,
    newIsActiveVWC,
    newVisibleInAdminVWC,
  ]);

  const saveInner = useCallback(
    async (signal: AbortSignal | undefined) => {
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        throw new Error('Not logged in');
      }
      const loginContext = loginContextUnch;

      const precondition: any & object = {
        purpose: onboardingVideo.purpose,
        video_content_file_uid: onboardingVideo.videoContent.uid,
        thumbnail_image_file_uid: onboardingVideo.thumbnailImage.uid,
        active_at:
          onboardingVideo.activeAt === null ? null : onboardingVideo.activeAt.getTime() / 1000.0,
        visible_in_admin: onboardingVideo.visibleInAdmin,
        created_at: onboardingVideo.createdAt.getTime() / 1000.0,
      };

      const patch: any & object = {};

      const newPurpose = newPurposeVWC.get();
      if (!areOnboardingVideoPurposesEqual(newPurpose, onboardingVideo.purpose)) {
        patch.purpose = newPurpose;
      }

      const newVideo = newVideoVWC.get();
      if (newVideo !== null && newVideo.contentFile.uid !== onboardingVideo.videoContent.uid) {
        patch.video_content_file_uid = newVideo.contentFile.uid;
      }

      const newThumbnail = newThumbnailVWC.get();
      if (
        newThumbnail !== null &&
        newThumbnail.imageFile.uid !== onboardingVideo.thumbnailImage.uid
      ) {
        patch.thumbnail_image_file_uid = newThumbnail;
      }

      const newIsActive = newIsActiveVWC.get();
      const wasActive = onboardingVideo.activeAt !== null;
      if (newIsActive !== wasActive) {
        patch.active = newIsActive;
      }

      const newVisibleInAdmin = newVisibleInAdminVWC.get();
      if (newVisibleInAdmin !== onboardingVideo.visibleInAdmin) {
        patch.visible_in_admin = newVisibleInAdmin;
      }

      signal?.throwIfAborted();

      if (newIsActive && (!wasActive || patch.purpose !== undefined)) {
        const serdPurpose = JSON.stringify(newPurpose, Object.keys(newPurpose).sort());
        const response = await apiFetch(
          '/api/1/onboarding/videos/search',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            signal,
            body: JSON.stringify({
              filters: {
                purpose: {
                  operator: 'eq',
                  value: serdPurpose,
                },
                active_at: {
                  operator: 'neq',
                  value: null,
                },
                uid: {
                  operator: 'neq',
                  value: onboardingVideo.uid,
                },
              },
              limit: 1,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
        const data: { items: any[] } = await response.json();
        if (data.items.length > 0) {
          const conflict = convertUsingMapper(data.items[0], onboardingVideoKeyMap);

          const confirmation = await showYesNoModal(modalContext.modals, {
            title: 'Replace Active?',
            body:
              'This is going to replace the active onboarding video for this purpose. ' +
              `The currently active video, ${conflict.uid}, will become inactive. ` +
              'This may take a moment to be reflected in the admin area, ' +
              'so you will have to refresh after making this edit.\n\n' +
              'It is usually less confusing to perform the two edits separately.',
            cta1: 'Replace',
            cta2: 'Cancel',
            emphasize: 2,
          }).promise;

          if (!confirmation) {
            throw new Error('canceled');
          }

          precondition.active_onboarding_video_for_purpose_uid = conflict.uid;
        } else {
          precondition.active_onboarding_video_for_purpose_uid = null;
        }
      }
      const response = await apiFetch(
        '/api/1/onboarding/videos/',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            uid: onboardingVideo.uid,
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
      const parsed = convertUsingMapper(raw, onboardingVideoKeyMap);
      setOnboardingVideo(parsed);
    },
    [
      onboardingVideo,
      loginContextRaw.value,
      modalContext.modals,
      newIsActiveVWC,
      newPurposeVWC,
      newThumbnailVWC,
      newVideoVWC,
      newVisibleInAdminVWC,
      setOnboardingVideo,
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
        if (
          typeof e === 'object' &&
          e !== null &&
          e.hasOwnProperty('message') &&
          (e as any).message === 'canceled'
        ) {
          setVWC(errorVWC, <>Operation canceled by user.</>);
          return;
        }
        const desc = await describeError(e);
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
    setVWC(saveIfNecessaryVWC, () => saveIfEditing(undefined));
  }, [saveIfNecessaryVWC, saveIfEditing]);

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

  return (
    <CrudItemBlock
      title={`${onboardingVideo.purpose.type} (${onboardingVideo.purpose.voice}, ${onboardingVideo.purpose.language})`}
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
        <RenderGuardedComponent
          props={errorVWC}
          component={(error) => <>{error && <ErrorBlock>{error}</ErrorBlock>}</>}
        />
        <OnboardingVideoUploadControl
          editingVWC={editingVWC}
          vwc={newVideoVWC}
          current={onboardingVideo.videoContent}
        />
        <OnboardingVideoThumbnailControl
          editingVWC={editingVWC}
          vwc={newThumbnailVWC}
          current={onboardingVideo.thumbnailImage}
          videoVWC={newVideoVWC}
          currentVideo={onboardingVideo.videoContent}
          imageHandler={imageHandler}
        />
        <OnboardingVideoPurposeControl editingVWC={editingVWC} vwc={newPurposeVWC} />
        <OnboardingVideoActiveControl editingVWC={editingVWC} vwc={newIsActiveVWC} />
        <OnboardingVideoVisibleInAdminControl
          editingVWC={editingVWC}
          vwc={newVisibleInAdminVWC}
          active={newIsActiveVWC}
        />
        <CrudFormElement title="UID">{onboardingVideo.uid}</CrudFormElement>
      </div>
    </CrudItemBlock>
  );
};

const OnboardingVideoUploadControl = ({
  editingVWC,
  vwc,
  current,
}: {
  editingVWC: WritableValueWithCallbacks<boolean>;
  vwc: WritableValueWithCallbacks<OnboardingVideoUpload | null>;
  current: OsehContentRef;
}): ReactElement => {
  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);
  const videoRef = useMappedValueWithCallbacks(vwc, (v) => (v === null ? current : v.contentFile), {
    outputEqualityFn: Object.is,
  });

  const showConfirmChange = useCallback(
    () =>
      showYesNoModal(modalContext.modals, {
        title: 'Replace Video?',
        body:
          'Views are merged by the onboarding video, not the actual video content file. ' +
          'Replacing this will not change its views, and it may not be possible to distinguish ' +
          'views from before this change and after. This is for minor revisions or prior to general ' +
          'availablility. If unsure, ensure this one is inactive, hide it from admin, and create a new onboarding ' +
          'video with the new version instead.',
        cta1: 'Replace',
        cta2: 'Cancel',
        emphasize: 2,
      }),
    [modalContext.modals]
  );

  return (
    <CrudFormElement title="Video">
      <div className={styles.content}>
        <RenderGuardedComponent
          props={videoRef}
          component={(ref) => (
            <OsehContent
              uid={ref.uid}
              jwt={ref.jwt}
              showAs="video"
              targetComparer={createVideoSizeComparerForTarget(180, 320)}
            />
          )}
        />
        <CrudSwappableElement
          version={editingVWC}
          falsey={() => <></>}
          truthy={() => (
            <RenderGuardedComponent
              props={vwc}
              component={(v) =>
                v === null ? (
                  <>
                    <Button
                      type="button"
                      variant="link"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!(await showConfirmChange().promise)) {
                          return;
                        }
                        const result = await showOnboardingVideoUploader(
                          modalContext.modals,
                          loginContextRaw
                        ).promise;
                        if (result) {
                          setVWC(vwc, result);
                        }
                      }}>
                      Upload
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!(await showConfirmChange().promise)) {
                          return;
                        }
                        const result = await showOnboardingVideoSelector(modalContext.modals)
                          .promise;
                        if (result) {
                          setVWC(vwc, result);
                        }
                      }}>
                      Select
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    onClick={async (e) => {
                      e.preventDefault();
                      setVWC(vwc, null);
                    }}>
                    Clear
                  </Button>
                )
              }
            />
          )}
        />
      </div>
    </CrudFormElement>
  );
};

const OnboardingVideoThumbnailControl = ({
  editingVWC,
  vwc,
  current,
  videoVWC,
  currentVideo,
  imageHandler,
}: {
  editingVWC: WritableValueWithCallbacks<boolean>;
  vwc: WritableValueWithCallbacks<OnboardingVideoThumbnail | null>;
  current: OsehImageRef;
  videoVWC: ValueWithCallbacks<OnboardingVideoUpload | null>;
  currentVideo: OsehContentRef;
  imageHandler: OsehImageStateRequestHandler;
}) => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);

  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, errorVWC, 'changing thumbnail');

  return (
    <CrudSwappableElement
      version={editingVWC}
      falsey={() => <></>}
      truthy={() => (
        <CrudFormElement title="Thumbnail / Cover">
          <RenderGuardedComponent
            props={vwc}
            component={(v) => {
              const ref = v === null ? current : v.imageFile;
              return (
                <div className={styles.content}>
                  <OsehImage
                    uid={ref.uid}
                    jwt={ref.jwt}
                    displayWidth={180}
                    displayHeight={320}
                    alt=""
                    handler={imageHandler}
                  />

                  {v === null ? (
                    <>
                      <Button
                        type="button"
                        variant="link"
                        onClick={async (e) => {
                          e.preventDefault();
                          const result = await showOnboardingVideoThumbnailUploader(
                            modalContext.modals,
                            loginContextRaw
                          ).promise;
                          if (result !== undefined) {
                            setVWC(vwc, result);
                          }
                        }}>
                        Upload
                      </Button>
                      <Button
                        type="button"
                        variant="filled"
                        onClick={async (e) => {
                          e.preventDefault();

                          const contentFileUID =
                            videoVWC.get()?.contentFile?.uid ?? currentVideo.uid;
                          if (contentFileUID === null) {
                            await showYesNoModal(modalContext.modals, {
                              title: 'No Thumbnails',
                              body: 'No generated thumbnails found (contentFileUID null)',
                              cta1: 'OK',
                              emphasize: null,
                            }).promise;
                            return;
                          }

                          const loginContextUnch = loginContextRaw.value.get();
                          if (loginContextUnch.state !== 'logged-in') {
                            setVWC(errorVWC, <>Not logged in</>);
                            return;
                          }
                          const loginContext = loginContextUnch;

                          try {
                            const response = await apiFetch(
                              '/api/1/onboarding/videos/uploads/search',
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                                body: JSON.stringify({
                                  filters: {
                                    content_file_uid: {
                                      operator: 'eq',
                                      value: contentFileUID,
                                    },
                                  },
                                  limit: 1,
                                }),
                              },
                              loginContext
                            );
                            if (!response.ok) {
                              throw response;
                            }
                            const data: { items: any[] } = await response.json();
                            if (data.items.length === 0) {
                              await showYesNoModal(modalContext.modals, {
                                title: 'No Thumbnails',
                                body: 'No generated thumbnails found (video is not a valid upload)',
                                cta1: 'OK',
                                emphasize: null,
                              }).promise;
                              return;
                            }

                            const item = convertUsingMapper(
                              data.items[0],
                              onboardingVideoUploadKeyMap
                            );

                            const result = await showOnboardingVideoThumbnailSelector(
                              modalContext.modals,
                              {
                                sourceVideoSHA512: item.contentFileOriginalSHA512,
                              }
                            ).promise;
                            if (result !== undefined) {
                              setVWC(vwc, result);
                            }
                          } catch (e) {
                            setVWC(errorVWC, await describeError(e));
                            return;
                          }
                        }}>
                        Select From Generated
                      </Button>
                      <Button
                        type="button"
                        variant="link"
                        onClick={async (e) => {
                          e.preventDefault();

                          const result = await showOnboardingVideoThumbnailSelector(
                            modalContext.modals
                          ).promise;
                          if (result !== undefined) {
                            setVWC(vwc, result);
                          }
                        }}>
                        Select From All
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="link"
                      onClick={async (e) => {
                        e.preventDefault();
                        setVWC(vwc, null);
                      }}>
                      Clear
                    </Button>
                  )}
                </div>
              );
            }}
          />
        </CrudFormElement>
      )}
    />
  );
};

const OnboardingVideoPurposeControl = ({
  editingVWC,
  vwc,
}: {
  editingVWC: WritableValueWithCallbacks<boolean>;
  vwc: WritableValueWithCallbacks<OnboardingVideoPurpose>;
}): ReactElement => {
  const languagesNR = useLanguagesNR();

  return (
    <CrudSwappableElement
      version={editingVWC}
      falsey={() => <></>}
      truthy={() => (
        <CrudFormElement title="Purpose">
          <RenderGuardedComponent
            props={vwc}
            component={({ type, ...rest }) => (
              <>
                <select
                  className={styles.purposeSelect}
                  onChange={(e) => {
                    const value = e.target.value;

                    const currentPurpose = vwc.get();
                    if (currentPurpose.type === value) {
                      return;
                    }

                    if (value === 'welcome') {
                      setVWC(vwc, {
                        type: 'welcome' as const,
                        voice: 'male' as const,
                        language: 'en',
                      });
                      return;
                    }

                    e.preventDefault();
                  }}
                  value={type}>
                  <option value="welcome">Welcome</option>
                </select>
                {type === 'welcome' && (
                  <>
                    <CrudFormElement title="Voice">
                      <select
                        className={styles.purposeSelect}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === rest.voice) {
                            return;
                          }
                          setVWC(vwc, {
                            type,
                            ...rest,
                            voice: value as 'male' | 'female' | 'ambiguous' | 'multiple',
                          });
                        }}
                        value={rest.voice}>
                        <option value="male">Masculine</option>
                        <option value="female">Feminine</option>
                        <option value="ambiguous">Ambiguous</option>
                        <option value="multiple">Multiple</option>
                      </select>
                    </CrudFormElement>
                    <CrudFormElement title="Language">
                      <select
                        className={styles.purposeSelect}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === rest.language) {
                            return;
                          }
                          setVWC(vwc, {
                            type,
                            ...rest,
                            language: value,
                          });
                        }}
                        value={rest.language}>
                        {/* eslint-disable-next-line react/jsx-pascal-case */}
                        <ISO639_1_Options forceInclude={rest.language} optionsNR={languagesNR} />
                      </select>
                    </CrudFormElement>
                  </>
                )}
              </>
            )}
            applyInstantly
          />
        </CrudFormElement>
      )}
    />
  );
};

const OnboardingVideoActiveControl = ({
  editingVWC,
  vwc,
}: {
  editingVWC: WritableValueWithCallbacks<boolean>;
  vwc: WritableValueWithCallbacks<boolean>;
}): ReactElement => {
  return (
    <CrudSwappableElement
      version={editingVWC}
      falsey={() => (
        <CrudFormElement title="Active">
          <RenderGuardedComponent
            props={vwc}
            component={(active) => <>{active ? 'Yes' : 'No'}</>}
          />
        </CrudFormElement>
      )}
      truthy={() => (
        <div className={styles.active}>
          <RenderGuardedComponent
            props={vwc}
            component={(active) => (
              <Checkbox value={active} setValue={(value) => setVWC(vwc, value)} label="Active" />
            )}
            applyInstantly
          />
        </div>
      )}
    />
  );
};

const OnboardingVideoVisibleInAdminControl = ({
  editingVWC,
  vwc,
  active,
}: {
  editingVWC: WritableValueWithCallbacks<boolean>;
  vwc: WritableValueWithCallbacks<boolean>;
  active: ValueWithCallbacks<boolean>;
}): ReactElement => {
  const modalContext = useContext(ModalContext);
  return (
    <CrudSwappableElement
      version={editingVWC}
      falsey={() => (
        <CrudFormElement title="Visible In Admin">
          <RenderGuardedComponent
            props={vwc}
            component={(visible) => <>{visible ? 'Yes' : 'No'}</>}
          />
        </CrudFormElement>
      )}
      truthy={() => (
        <div className={styles.active}>
          <RenderGuardedComponent
            props={vwc}
            component={(visible) => (
              <Checkbox
                value={visible}
                setValue={async (value) => {
                  if (!value && active) {
                    const confirmation = await showYesNoModal(modalContext.modals, {
                      title: 'Hide despite active?',
                      body: 'All this does is hide the video in the admin area by default. It usually does not make sense to do this if the video is active. Are you sure?',
                      cta1: 'Hide',
                      cta2: 'Cancel',
                      emphasize: 2,
                    }).promise;
                    if (!confirmation) {
                      return;
                    }
                  }
                  setVWC(vwc, value);
                }}
                label="Visible In Admin Area"
              />
            )}
            applyInstantly
          />
        </div>
      )}
    />
  );
};
