import { ReactElement, useCallback, useContext } from 'react';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import styles from './CreateOnboardingVideo.module.css';
import { OnboardingVideo, OnboardingVideoPurpose, onboardingVideoKeyMap } from './OnboardingVideo';
import { OnboardingVideoUpload } from './uploads/OnboardingVideoUpload';
import { CrudCreateBlock } from '../crud/CrudCreateBlock';
import { Button } from '../../shared/forms/Button';
import { CrudFormElement } from '../crud/CrudFormElement';
import { setVWC } from '../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { OsehContent } from '../../shared/content/OsehContent';
import { createVideoSizeComparerForTarget } from '../../shared/content/createVideoSizeComparerForTarget';
import { showOnboardingVideoUploader } from './uploads/showOnboardingVideoUploader';
import { showOnboardingVideoSelector } from './uploads/showOnboardingVideoSelector';
import { OnboardingVideoThumbnail } from './thumbnails/OnboardingVideoThumbnail';
import { showOnboardingVideoThumbnailUploader } from './thumbnails/showOnboardingVideoThumbnailUploader';
import { showOnboardingVideoThumbnailSelector } from './thumbnails/showOnboardingVideoThumbnailSelector';
import { OsehImage } from '../../shared/images/OsehImage';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { apiFetch } from '../../shared/ApiConstants';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { convertUsingMapper } from '../crud/CrudFetcher';
import { ISO639_1_Options, useLanguagesNR } from '../../shared/components/ISO639_1_Options';
import { chooseErrorFromStatus, DisplayableError } from '../../shared/lib/errors';

type CreateOnboardingVideoProps = {
  /**
   * Called after an onboarding video is created by the user
   * @param onboardingVideo The onboarding video that was created
   */
  onCreated: (this: void, onboardingVideo: OnboardingVideo) => void;

  /**
   * Image handler for loading images
   */
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Renders a block which allows the user to create a new onboarding video.
 */
export const CreateOnboardingVideo = ({
  onCreated,
  imageHandler,
}: CreateOnboardingVideoProps): ReactElement => {
  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);

  const videoVWC = useWritableValueWithCallbacks<OnboardingVideoUpload | null>(() => null);
  const thumbnailVWC = useWritableValueWithCallbacks<OnboardingVideoThumbnail | null>(() => null);
  const purposeVWC = useWritableValueWithCallbacks<OnboardingVideoPurpose | null>(() => null);
  const voiceVWC = useMappedValueWithCallbacks(purposeVWC, (p) =>
    p?.type === 'welcome' ? p.voice : 'male'
  );
  const languageVWC = useMappedValueWithCallbacks(purposeVWC, (p) =>
    p?.type === 'welcome' ? p.language : 'en'
  );

  const readyVWC = useMappedValuesWithCallbacks(
    [videoVWC, thumbnailVWC, purposeVWC],
    () => videoVWC.get() !== null && thumbnailVWC.get() !== null && purposeVWC.get() !== null
  );

  const savingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const errorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  useErrorModal(modalContext.modals, errorVWC);

  const doSave = useCallback(async () => {
    if (savingVWC.get() || !readyVWC.get()) {
      return;
    }

    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }

    const loginContext = loginContextUnch;

    const video = videoVWC.get();
    const thumbnail = thumbnailVWC.get();
    const purpose = purposeVWC.get();

    if (video === null || thumbnail === null || purpose === null) {
      return;
    }

    setVWC(errorVWC, null);
    setVWC(savingVWC, true);
    try {
      let response;
      try {
        response = await apiFetch(
          '/api/1/onboarding/videos/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              purpose,
              upload_uid: video.uid,
              thumbnail_uid: thumbnail.uid,
            }),
          },
          loginContext
        );
      } catch {
        throw new DisplayableError('connectivity', 'create onboarding video');
      }

      if (!response.ok) {
        throw chooseErrorFromStatus(response.status, 'create onboarding video');
      }

      const raw = await response.json();
      const parsed = convertUsingMapper(raw, onboardingVideoKeyMap);
      onCreated(parsed);
      setVWC(videoVWC, null);
      setVWC(thumbnailVWC, null);
      setVWC(purposeVWC, null);
    } catch (e) {
      setVWC(
        errorVWC,
        e instanceof DisplayableError
          ? e
          : new DisplayableError('client', 'create onboarding video', `${e}`)
      );
    } finally {
      setVWC(savingVWC, false);
    }
  }, [
    savingVWC,
    readyVWC,
    errorVWC,
    videoVWC,
    thumbnailVWC,
    purposeVWC,
    loginContextRaw,
    onCreated,
  ]);

  const disabledVWC = useMappedValuesWithCallbacks(
    [savingVWC, readyVWC],
    () => savingVWC.get() || !readyVWC.get()
  );

  const languagesNR = useLanguagesNR();

  return (
    <CrudCreateBlock>
      <CrudFormElement title="Video">
        <div className={styles.content}>
          <RenderGuardedComponent
            props={videoVWC}
            component={(video) => {
              if (video === null) {
                return (
                  <>
                    <Button
                      type="button"
                      variant="filled"
                      onClick={async (e) => {
                        e.preventDefault();
                        const result = await showOnboardingVideoUploader(
                          modalContext.modals,
                          loginContextRaw
                        ).promise;
                        if (result) {
                          setVWC(videoVWC, result);
                        }
                      }}>
                      Upload
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      onClick={async (e) => {
                        e.preventDefault();
                        const result = await showOnboardingVideoSelector(modalContext.modals)
                          .promise;
                        if (result) {
                          setVWC(videoVWC, result);
                        }
                      }}>
                      Select
                    </Button>
                  </>
                );
              }
              return (
                <>
                  <OsehContent
                    uid={video.contentFile.uid}
                    jwt={video.contentFile.jwt}
                    showAs="video"
                    playerStyle={{ width: '390px', height: '844px' }}
                    targetComparer={createVideoSizeComparerForTarget(390, 844)}
                  />
                  <Button type="button" variant="link" onClick={() => setVWC(videoVWC, null)}>
                    Clear
                  </Button>
                </>
              );
            }}
          />
        </div>
      </CrudFormElement>
      <CrudFormElement title="Thumbnail / Cover">
        <div className={styles.content}>
          <RenderGuardedComponent
            props={thumbnailVWC}
            component={(thumbnail) => {
              if (thumbnail === null) {
                return (
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
                        if (result) {
                          setVWC(thumbnailVWC, result);
                        }
                      }}>
                      Upload
                    </Button>
                    <RenderGuardedComponent
                      props={videoVWC}
                      component={(video) => {
                        if (video === null) {
                          return <></>;
                        }

                        return (
                          <Button
                            type="button"
                            variant="filled"
                            onClick={async (e) => {
                              e.preventDefault();
                              const result = await showOnboardingVideoThumbnailSelector(
                                modalContext.modals,
                                {
                                  sourceVideoSHA512: video.contentFileOriginalSHA512,
                                }
                              ).promise;
                              if (result) {
                                setVWC(thumbnailVWC, result);
                              }
                            }}>
                            Select From Generated
                          </Button>
                        );
                      }}
                    />
                    <Button
                      type="button"
                      variant="link"
                      onClick={async (e) => {
                        e.preventDefault();
                        const result = await showOnboardingVideoThumbnailSelector(
                          modalContext.modals
                        ).promise;
                        if (result) {
                          setVWC(thumbnailVWC, result);
                        }
                      }}>
                      Select From All
                    </Button>
                  </>
                );
              }
              return (
                <>
                  <OsehImage
                    uid={thumbnail.imageFile.uid}
                    jwt={thumbnail.imageFile.jwt}
                    displayWidth={390}
                    displayHeight={844}
                    alt=""
                    handler={imageHandler}
                  />
                  <Button type="button" variant="link" onClick={() => setVWC(thumbnailVWC, null)}>
                    Clear
                  </Button>
                </>
              );
            }}
          />
        </div>
      </CrudFormElement>
      <CrudFormElement title="Purpose">
        <div className={styles.purpose}>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(purposeVWC, (p) => p?.type ?? 'none')}
            applyInstantly
            component={(selected) => (
              <>
                <select
                  className={styles.purposeSelect}
                  onChange={(e) => {
                    const value = e.target.value;

                    const currentPurpose = purposeVWC.get();
                    if (currentPurpose !== null && currentPurpose.type === value) {
                      return;
                    }

                    if (value === 'none') {
                      if (currentPurpose === null) {
                        return;
                      }
                      setVWC(purposeVWC, null);
                      return;
                    }

                    if (value === 'welcome') {
                      setVWC(purposeVWC, {
                        type: 'welcome' as const,
                        voice: 'male' as const,
                        language: 'en',
                      });
                      return;
                    }

                    e.preventDefault();
                  }}
                  value={selected}>
                  <option value="none">Select One</option>
                  <option value="welcome">Welcome</option>
                </select>
                {selected === 'welcome' && (
                  <>
                    <CrudFormElement title="Voice">
                      <RenderGuardedComponent
                        props={voiceVWC}
                        applyInstantly
                        component={(voice) => (
                          <select
                            className={styles.purposeSelect}
                            onChange={(e) => {
                              const value = e.target.value;
                              const currentPurpose = purposeVWC.get();
                              if (currentPurpose === null || currentPurpose.type !== 'welcome') {
                                return;
                              }
                              if (value === voice) {
                                return;
                              }
                              setVWC(purposeVWC, {
                                ...currentPurpose,
                                voice: value as 'male' | 'female' | 'ambiguous' | 'multiple',
                              });
                            }}
                            value={voice}>
                            <option value="male">Masculine</option>
                            <option value="female">Feminine</option>
                            <option value="ambiguous">Ambiguous</option>
                            <option value="multiple">Multiple</option>
                          </select>
                        )}
                      />
                    </CrudFormElement>
                    <CrudFormElement title="Language">
                      <RenderGuardedComponent
                        props={languageVWC}
                        applyInstantly
                        component={(language) => (
                          <select
                            className={styles.purposeSelect}
                            onChange={(e) => {
                              const value = e.target.value;
                              const currentPurpose = purposeVWC.get();
                              if (currentPurpose === null || currentPurpose.type !== 'welcome') {
                                return;
                              }
                              if (value === language) {
                                return;
                              }
                              setVWC(purposeVWC, {
                                ...currentPurpose,
                                language: value,
                              });
                            }}
                            value={language}>
                            {/* eslint-disable-next-line react/jsx-pascal-case */}
                            <ISO639_1_Options forceInclude={language} optionsNR={languagesNR} />
                          </select>
                        )}
                      />
                    </CrudFormElement>
                  </>
                )}
              </>
            )}
          />
        </div>
      </CrudFormElement>
      <div className={styles.save}>
        <RenderGuardedComponent
          props={disabledVWC}
          component={(disabled) => (
            <Button
              type="button"
              variant="filled"
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                doSave();
              }}>
              Create
            </Button>
          )}
        />
      </div>
    </CrudCreateBlock>
  );
};
