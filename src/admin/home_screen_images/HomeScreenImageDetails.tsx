import { ReactElement, useCallback, useContext } from 'react';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { HomeScreenImage, homeScreenImageKeyMap } from './HomeScreenImage';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import { CrudFormElement } from '../crud/CrudFormElement';
import {
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { useWorkingModal } from '../../shared/hooks/useWorkingModal';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { setVWC } from '../../shared/lib/setVWC';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { describeError } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingMapper } from '../crud/CrudFetcher';
import { OsehImage } from '../../shared/images/OsehImage';
import { useValuesWithCallbacksEffect } from '../../shared/hooks/useValuesWithCallbacksEffect';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import styles from './HomeScreenImageDetails.module.css';
import { inputToSecondsOffset, secondsOffsetToInput } from '../../shared/lib/secondsOffsetUtils';
import { useBeforeTime } from '../../shared/hooks/useBeforeTime';
import { Checkbox } from '../../shared/forms/Checkbox';
import { HomeScreenImageFlags } from './flags/HomeScreenImageFlags';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { Button } from '../../shared/forms/Button';
import { showYesNoModal } from '../../shared/lib/showYesNoModal';

type HomeScreenImageDetailsProps = {
  /**
   * The home screen image to display
   */
  homeScreenImage: HomeScreenImage;

  /**
   * Used to update the home screen image after a confirmation from the server
   */
  setHomeScreenImage: (this: void, homeScreenImage: HomeScreenImage) => void;

  /**
   * The handler for loading images
   */
  imageHandler: OsehImageStateRequestHandler;

  /**
   * Can be set to guard against closing the modal while a save is in progress
   */
  editingVWC: WritableValueWithCallbacks<boolean>;
};

type HomeScreenImagePatch = {
  start_time?: number;
  end_time?: number;
  flags?: number;
  dates?: string[] | null;
  live_at: number;
};

/**
 * Traditional component for the home screen image to patch the mutable
 * fields
 */
export const HomeScreenImageDetails = ({
  homeScreenImage,
  setHomeScreenImage,
  imageHandler,
  editingVWC,
}: HomeScreenImageDetailsProps): ReactElement => {
  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);
  const savingVWC = useWritableValueWithCallbacks(() => false);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const saveAt = useWritableValueWithCallbacks<number | null>(() => null);
  const queuedPatchVWC = useWritableValueWithCallbacks<HomeScreenImagePatch | null>(() => null);
  const saveDueInverted = useBeforeTime({
    type: 'callbacks',
    props: () => saveAt.get() ?? undefined,
    callbacks: saveAt.callbacks,
  });
  useWorkingModal(modalContext.modals, savingVWC, { delayStartMs: 100 });
  useErrorModal(modalContext.modals, errorVWC, 'saving');

  useValuesWithCallbacksEffect([savingVWC, saveAt], () => {
    setVWC(editingVWC, savingVWC.get() || saveAt.get() !== null);
    return undefined;
  });

  const startTimeVWC = useWritableValueWithCallbacks<number>(() => homeScreenImage.startTime);
  const endTimeVWC = useWritableValueWithCallbacks<number>(() => homeScreenImage.endTime);
  const newFlagsVWC = useWritableValueWithCallbacks<number>(() => homeScreenImage.flags);
  const newDatesVWC = useWritableValueWithCallbacks<string[] | null>(() => homeScreenImage.dates);
  const dateAddRef = useWritableValueWithCallbacks<HTMLInputElement | null>(() => null);

  const doPatch = useCallback(
    async (patch: HomeScreenImagePatch): Promise<void> => {
      if (savingVWC.get()) {
        return;
      }
      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        return;
      }
      const loginContext = loginContextUnch;

      setVWC(savingVWC, true);
      setVWC(saveAt, null);
      setVWC(errorVWC, null);
      const oldImage = homeScreenImage;
      try {
        const response = await apiFetch(
          '/api/1/personalization/home/images/',
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              uid: oldImage.uid,
              precondition: {
                image_file_uid: oldImage.imageFile.uid,
                darkened_image_file_uid: oldImage.darkenedImageFile.uid,
                start_time: oldImage.startTime,
                end_time: oldImage.endTime,
                flags: oldImage.flags,
                dates: oldImage.dates,
              },
              patch,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          if (response.status === 412) {
            const errInfo = await describeError(response);
            const updateResponse = await apiFetch(
              '/api/1/personalization/home/images/search',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                  filters: { uid: { operator: 'eq', value: oldImage.uid } },
                  limit: 1,
                }),
              },
              loginContext
            );
            if (!updateResponse.ok) {
              throw updateResponse;
            }
            const update: { items: any[] } = await updateResponse.json();
            if (update.items.length === 0) {
              throw new Error('The image was deleted');
            }
            const updatedImage = convertUsingMapper(update.items[0], homeScreenImageKeyMap);
            setHomeScreenImage(updatedImage);
            setVWC(
              errorVWC,
              <>
                <p>The image was updated by someone else. Please try again.</p>
                <p>Old image:</p>
                <pre>{JSON.stringify(oldImage, null, 2)}</pre>
                <p>New image:</p>
                <pre>{JSON.stringify(updatedImage, null, 2)}</pre>
                <p>Error:</p>
                {errInfo}
              </>
            );
            return;
          }
          throw response;
        }
        const updatedImageRaw: any = await response.json();
        const updatedImage = convertUsingMapper(updatedImageRaw, homeScreenImageKeyMap);
        setHomeScreenImage(updatedImage);
      } catch (e) {
        const err = await describeError(e);
        setVWC(errorVWC, err);
      } finally {
        setVWC(savingVWC, false);
      }
    },
    [homeScreenImage, setHomeScreenImage, savingVWC, loginContextRaw, errorVWC, saveAt]
  );

  useValuesWithCallbacksEffect([saveDueInverted, savingVWC, queuedPatchVWC], () => {
    const saveDue = !saveDueInverted.get();
    const saving = savingVWC.get();
    const patch = queuedPatchVWC.get();
    if (saving || !saveDue || patch === null) {
      return undefined;
    }
    setVWC(queuedPatchVWC, null);
    doPatch(patch);
    return undefined;
  });

  return (
    <CrudItemBlock
      title={homeScreenImage.uid}
      controls={
        <RenderGuardedComponent
          props={saveAt}
          component={(saveAt) =>
            saveAt === null ? (
              <div className={styles.edited}>saved</div>
            ) : (
              <div className={styles.edited}>edited</div>
            )
          }
        />
      }>
      <CrudFormElement title="Image" addChildrenTopMargin="4px">
        <OsehImage
          uid={homeScreenImage.imageFile.uid}
          jwt={homeScreenImage.imageFile.jwt}
          displayWidth={360}
          displayHeight={258}
          alt=""
          handler={imageHandler}
        />
      </CrudFormElement>
      <CrudFormElement title="Darkened Image" addChildrenTopMargin="4px">
        <OsehImage
          uid={homeScreenImage.darkenedImageFile.uid}
          jwt={homeScreenImage.darkenedImageFile.jwt}
          displayWidth={360}
          displayHeight={258}
          alt=""
          handler={imageHandler}
        />
      </CrudFormElement>
      <CrudFormElement title="Start Time">
        <input
          type="time"
          className={styles.formItemInput}
          defaultValue={secondsOffsetToInput(startTimeVWC.get())}
          onChange={(e) => {
            const time = e.target.value;
            const parsed = inputToSecondsOffset(time);
            if (parsed !== null) {
              setVWC(saveAt, Date.now() + 1000);
              setVWC(
                queuedPatchVWC,
                Object.assign({}, queuedPatchVWC.get(), {
                  start_time: parsed,
                })
              );
              const currentEnd = endTimeVWC.get();
              if (currentEnd > parsed + 86400) {
                const newEnd = currentEnd - 86400;
                setVWC(
                  queuedPatchVWC,
                  Object.assign({}, queuedPatchVWC.get(), {
                    end_time: newEnd,
                  })
                );
                setVWC(endTimeVWC, newEnd);
              }
              setVWC(startTimeVWC, parsed);
            }
          }}
        />
      </CrudFormElement>
      <CrudFormElement title="End Time">
        <input
          type="time"
          className={styles.formItemInput}
          defaultValue={secondsOffsetToInput(endTimeVWC.get() % 86400)}
          onChange={(e) => {
            const time = e.target.value;
            let parsed = inputToSecondsOffset(time, true);
            if (parsed !== null) {
              const currentStart = startTimeVWC.get();
              if (parsed < currentStart) {
                parsed += 86400;
              }

              setVWC(saveAt, Date.now() + 1000);
              setVWC(
                queuedPatchVWC,
                Object.assign({}, queuedPatchVWC.get(), {
                  end_time: parsed,
                })
              );
              setVWC(endTimeVWC, parsed);
            }
          }}
        />
      </CrudFormElement>
      <CrudFormElement title="Days of the Week" addChildrenTopMargin="4px">
        <div className={styles.flags}>
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_MONDAY}
            label="Monday"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_TUESDAY}
            label="Tuesday"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_WEDNESDAY}
            label="Wednesday"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_THURSDAY}
            label="Thursday"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_FRIDAY}
            label="Friday"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_SATURDAY}
            label="Saturday"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_SUNDAY}
            label="Sunday"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
        </div>
      </CrudFormElement>
      <CrudFormElement title="Months / Seasons" addChildrenTopMargin="4px">
        <div className={styles.flags}>
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_JANUARY}
            label="January"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_FEBRUARY}
            label="February"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_MARCH}
            label="March"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_APRIL}
            label="April"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_MAY}
            label="May"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_JUNE}
            label="June"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_JULY}
            label="July"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_AUGUST}
            label="August"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_SEPTEMBER}
            label="September"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_OCTOBER}
            label="October"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_NOVEMBER}
            label="November"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_DECEMBER}
            label="December"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
        </div>
      </CrudFormElement>
      <CrudFormElement title="Specific Dates">
        <div className={styles.help}>
          Can be used for holiday-specific imagery. Checking the box prevents the image from being
          shown except on the indicated dates.
        </div>
        <RenderGuardedComponent
          props={newDatesVWC}
          component={(newDates) => (
            <>
              <Checkbox
                value={newDates !== null}
                setValue={async (v) => {
                  if (v === (newDates !== null)) {
                    return;
                  }

                  if (!v && newDates !== null && newDates.length > 0) {
                    const result = await showYesNoModal(modalContext.modals, {
                      title: 'Remove all dates?',
                      body: 'Unchecking this will delete all the existing date restrictions on this image, then disable date restrictions. Are you sure?',
                      cta1: 'Delete',
                      cta2: 'Cancel',
                      emphasize: 1,
                    }).promise;
                    if (!result) {
                      return;
                    }
                  }

                  setVWC(saveAt, Date.now() + 1000);
                  const newValue = v ? [] : null;
                  setVWC(
                    queuedPatchVWC,
                    Object.assign({}, queuedPatchVWC.get(), { dates: newValue })
                  );
                  setVWC(newDatesVWC, newValue);
                }}
                label="Enabled"
              />
              {newDates !== null && (
                <>
                  <div className={styles.dates}>
                    <div className={styles.datesTitle}>Dates:</div>
                    <div className={styles.datesList}>
                      {newDates.map((d) => {
                        const date = new Date(d + 'T00:00:00');

                        return (
                          <div className={styles.date} key={d}>
                            <div className={styles.dateValue}>{date.toLocaleDateString()}</div>
                            <Button
                              type="button"
                              variant="link-small"
                              onClick={(e) => {
                                e.preventDefault();
                                setVWC(saveAt, Date.now() + 1000);
                                const newValue = newDates.filter((v) => v !== d);
                                setVWC(
                                  queuedPatchVWC,
                                  Object.assign({}, queuedPatchVWC.get(), { dates: newValue })
                                );
                                setVWC(newDatesVWC, newValue);
                              }}>
                              Remove
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className={styles.dateAdd}>
                    <input type="date" ref={(r) => setVWC(dateAddRef, r)} />
                    <Button
                      type="button"
                      variant="link-small"
                      onClick={(e) => {
                        e.preventDefault();
                        const inp = dateAddRef.get();
                        if (inp === null) {
                          return;
                        }

                        const inpDate = inp.valueAsDate;
                        if (!inpDate) {
                          return;
                        }

                        const inpDateStr = inpDate.toISOString().split('T')[0];
                        if (newDates.includes(inpDateStr)) {
                          return;
                        }

                        setVWC(saveAt, Date.now() + 1000);
                        const newValue = newDates.concat([inpDateStr]);
                        newValue.sort();
                        setVWC(
                          queuedPatchVWC,
                          Object.assign({}, queuedPatchVWC.get(), { dates: newValue })
                        );
                        setVWC(newDatesVWC, newValue);
                      }}>
                      Add
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
          applyInstantly
        />
      </CrudFormElement>
      <CrudFormElement title="Who" addChildrenTopMargin="4px">
        <div className={styles.flags}>
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_WITHOUT_PRO}
            label="Free Users"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_WITH_PRO}
            label="Pro Users"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
        </div>
      </CrudFormElement>
      <CrudFormElement title="Hide In Admin" addChildrenTopMargin="4px">
        <div className={styles.flags}>
          <FlagCheckbox
            flag={HomeScreenImageFlags.VISIBLE_IN_ADMIN}
            label="Visible in Admin Area"
            queuedPatchVWC={queuedPatchVWC}
            newFlagsVWC={newFlagsVWC}
            saveAt={saveAt}
          />
        </div>
      </CrudFormElement>
    </CrudItemBlock>
  );
};

const FlagCheckbox = ({
  flag,
  label,
  queuedPatchVWC,
  newFlagsVWC,
  saveAt,
}: {
  flag: HomeScreenImageFlags;
  label: string;
  queuedPatchVWC: WritableValueWithCallbacks<HomeScreenImagePatch | null>;
  newFlagsVWC: WritableValueWithCallbacks<number>;
  saveAt: WritableValueWithCallbacks<number | null>;
}): ReactElement => {
  return (
    <RenderGuardedComponent
      props={useMappedValueWithCallbacks(newFlagsVWC, (flags) => (flags & flag) !== 0)}
      component={(value) => (
        <Checkbox
          value={value}
          setValue={(v) => {
            setVWC(saveAt, Date.now() + 1000);
            setVWC(newFlagsVWC, v ? newFlagsVWC.get() | flag : newFlagsVWC.get() & ~flag);
            setVWC(
              queuedPatchVWC,
              Object.assign({}, queuedPatchVWC.get(), {
                flags: newFlagsVWC.get(),
              })
            );
          }}
          label={label}
        />
      )}
      applyInstantly
    />
  );
};
