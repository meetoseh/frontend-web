import { ReactElement, useCallback } from 'react';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { Modals, addModalWithCallbackToRemove } from '../../../shared/contexts/ModalContext';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { CourseJourney, courseJourneyKeyMap } from './CourseJourney';
import styles from './showEditCourseJourneyAssociationModal.module.css';
import { UseCourseJourneysResult } from './useCourseJourneys';
import { constructCancelablePromise } from '../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { SlideInModal } from '../../../shared/components/SlideInModal';
import { TextInput } from '../../../shared/forms/TextInput';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { setVWC } from '../../../shared/lib/setVWC';
import { Button } from '../../../shared/forms/Button';
import { apiFetch } from '../../../shared/ApiConstants';
import { convertUsingMapper } from '../../crud/CrudFetcher';
import {
  chooseErrorFromStatus,
  DisplayableError,
  SimpleDismissBoxError,
} from '../../../shared/lib/errors';

/**
 * Opens a modal to allow the user to pick an instructor, then
 * resolves the instructor selected (if they chose one), or null
 * if they dismissed the modal without picking an instructor.
 *
 * Can cancel the returned promise to close the modal, which will
 * cause the promise to be rejected.
 */
export const showEditCourseJourneyAssociationModal = ({
  journeys,
  item,
  loginContextRaw,
  modals,
  imageHandler,
}: {
  journeys: UseCourseJourneysResult;
  item: CourseJourney;
  loginContextRaw: LoginContextValue;
  modals: WritableValueWithCallbacks<Modals>;
  imageHandler: OsehImageStateRequestHandler;
}): CancelablePromise<void> => {
  return constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const canceled = createCancelablePromiseFromCallbacks(state.cancelers);
      canceled.promise.catch(() => {});

      if (state.finishing) {
        canceled.cancel();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      const requestClose = createWritableValueWithCallbacks<() => void>(() => {});
      const disabled = createWritableValueWithCallbacks<boolean>(true);

      let closedPromiseResolve: () => void = () => {};
      const closedPromise = new Promise<void>((resolve) => {
        closedPromiseResolve = resolve;
      });

      const closeModal = addModalWithCallbackToRemove(
        modals,
        <SlideInModal
          title="Modify the course journey association"
          onClosed={() => {
            closedPromiseResolve();
          }}
          requestClose={requestClose}
          animating={disabled}>
          <Inner
            journeys={journeys}
            item={item}
            loginContextRaw={loginContextRaw}
            disabled={disabled}
            imageHandler={imageHandler}
            requestCloseVWC={requestClose}
          />
        </SlideInModal>
      );

      try {
        await Promise.race([closedPromise, canceled.promise]);
      } finally {
        closeModal();
        closedPromiseResolve();
        canceled.cancel();

        state.finishing = true;
        state.done = true;
        resolve();
      }
    },
  });
};

const Inner = ({
  journeys,
  item,
  loginContextRaw,
  disabled,
  imageHandler,
  requestCloseVWC,
}: {
  journeys: UseCourseJourneysResult;
  item: CourseJourney;
  loginContextRaw: LoginContextValue;
  disabled: ValueWithCallbacks<boolean>;
  imageHandler: OsehImageStateRequestHandler;
  requestCloseVWC: ValueWithCallbacks<() => void>;
}): ReactElement => {
  const errorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  const priorityVWC = useWritableValueWithCallbacks<string>(() => item.priority.toString());

  const onSave = useCallback(async () => {
    const action = 'save course journey association';
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      throw new DisplayableError('server-refresh-required', action, 'not logged in');
    }
    const loginContext = loginContextUnch;

    const priority = parseInt(priorityVWC.get(), 10);

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
      throw new DisplayableError('connectivity', action);
    }
    if (!response.ok) {
      throw chooseErrorFromStatus(response.status, action);
    }
    const newRaw = await response.json();
    const newCJ = convertUsingMapper(newRaw, courseJourneyKeyMap);
    journeys.onChange(newCJ);
    requestCloseVWC.get()();
  }, [loginContextRaw.value, item, journeys, priorityVWC, requestCloseVWC]);

  const onRemove = useCallback(async () => {
    const action = 'remove course journey association';
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      throw new DisplayableError('server-refresh-required', action, 'not logged in');
    }
    const loginContext = loginContextUnch;

    let response;
    try {
      response = await apiFetch(
        '/api/1/courses/journeys/' + item.associationUid,
        { method: 'DELETE' },
        loginContext
      );
    } catch {
      throw new DisplayableError('connectivity', action);
    }

    if (!response.ok) {
      throw chooseErrorFromStatus(response.status, action);
    }

    journeys.onDelete(item);
    requestCloseVWC.get()();
  }, [loginContextRaw.value, item, journeys, requestCloseVWC]);

  return (
    <div className={styles.container}>
      <SimpleDismissBoxError error={errorVWC} />
      <RenderGuardedComponent
        props={disabled}
        component={(disabled) => (
          <>
            <RenderGuardedComponent
              props={priorityVWC}
              component={(priorityStr) => (
                <TextInput
                  label="Priority"
                  type="number"
                  value={priorityStr}
                  onChange={(v) => {
                    setVWC(priorityVWC, v);
                  }}
                  help="Lower-valued priority journeys are shown first"
                  disabled={disabled}
                  inputStyle="white"
                  html5Validation={{ min: '0', step: '1' }}
                />
              )}
              applyInstantly
            />

            <div className={styles.buttons}>
              <Button
                type="button"
                variant="filled-white"
                onClick={async (e) => {
                  e.preventDefault();

                  setVWC(errorVWC, null);
                  try {
                    onSave();
                  } catch (e) {
                    setVWC(
                      errorVWC,
                      e instanceof DisplayableError
                        ? e
                        : new DisplayableError('client', 'save course journey association', `${e}`)
                    );
                  }
                }}
                disabled={disabled}>
                Save
              </Button>
              <Button
                type="button"
                variant="link-white"
                onClick={async (e) => {
                  e.preventDefault();
                  setVWC(errorVWC, null);

                  try {
                    onRemove();
                  } catch (e) {
                    setVWC(
                      errorVWC,
                      e instanceof DisplayableError
                        ? e
                        : new DisplayableError(
                            'client',
                            'remove course journey association',
                            `${e}`
                          )
                    );
                  }
                }}
                disabled={disabled}>
                Remove Association
              </Button>
            </div>
          </>
        )}
      />
    </div>
  );
};
