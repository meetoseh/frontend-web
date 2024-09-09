import { ReactElement, useContext, useEffect } from 'react';
import {
  Callbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { SCREEN_VERSION } from '../../../shared/lib/screenVersion';
import { clientFlowAnalysisStandardEnvironments } from './clientFlowAnalysisStandardEnvironments';
import {
  ClientFlowAnalysisEnvironment,
  convertClientFlowAnalysisEnvironmentToAPI,
} from './ClientFlowAnalysisEnvironment';
import { createValueWithCallbacksEffect } from '../../../shared/hooks/createValueWithCallbacksEffect';
import { setVWC } from '../../../shared/lib/setVWC';
import { waitForValueWithCallbacksConditionCancelable } from '../../../shared/lib/waitForValueWithCallbacksCondition';
import { describeError, ErrorBlock } from '../../../shared/forms/ErrorBlock';
import {
  ClientFlowAnalyzeReachableRequest,
  clientFlowsAnalyzeReachable,
} from './ClientFlowAnalyzeReachable';
import { LoginContext, LoginContextValueLoggedIn } from '../../../shared/contexts/LoginContext';
import { createCancelableTimeout } from '../../../shared/lib/createCancelableTimeout';
import styles from './ClientFlowDeletePrechecks.module.css';
import { InlineOsehSpinner } from '../../../shared/components/InlineOsehSpinner';
import { Check } from '../../../shared/components/icons/Check';
import { OsehColors } from '../../../shared/OsehColors';
import { Close } from '../../../shared/components/icons/Close';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { createValuesWithCallbacksEffect } from '../../../shared/hooks/createValuesWithCallbacksEffect';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { HorizontalSpacer } from '../../../shared/components/HorizontalSpacer';
import { VerticalSpacer } from '../../../shared/components/VerticalSpacer';
import { Button } from '../../../shared/forms/Button';
import { screenWithWorking } from '../../../user/core/lib/screenWithWorking';
import { apiFetch } from '../../../shared/ApiConstants';
import { CancelablePromise } from '../../../shared/lib/CancelablePromise';
import { addModalWithCallbackToRemove, Modals } from '../../../shared/contexts/ModalContext';
import { constructCancelablePromise } from '../../../shared/lib/CancelablePromiseConstructor';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { ModalWrapper } from '../../../shared/ModalWrapper';

const QUERIES = [
  'not-reachable-from-home',
  'not-reachable-from-onboarding',
  'not-reachable-from-anywhere',
] as const;
type PrecheckQuery = (typeof QUERIES)[number];

export type WritableFlowDeletePrecheckItem = {
  /** the name that should be displayed to describe this item */
  name: string;
  /** the environment for the analysis */
  environment: ClientFlowAnalysisEnvironment;
  /** what we're verifying */
  query: PrecheckQuery;
  /**
   * the state for this item (spinner, checkmark, x)
   * - `waiting`: maximum number of concurrent checks are already running; waiting
   *   for one to finish
   * - `loading`: currently running this check
   * - `success`: check passed
   * - `failed`: check failed
   */
  state: WritableValueWithCallbacks<'waiting' | 'loading' | 'success' | 'failed'>;
  /** if more data should be shown below the name, the additional context to provide */
  message: WritableValueWithCallbacks<ReactElement | null>;
};

const makeRequest = (
  slug: string,
  item: WritableFlowDeletePrecheckItem
): ClientFlowAnalyzeReachableRequest => {
  const settings = convertClientFlowAnalysisEnvironmentToAPI(item.environment);
  if (item.query === 'not-reachable-from-home') {
    return {
      settings,
      source: 'empty',
      target: slug,
      inverted: false,
      max_steps: null,
      offset_paths: 0,
      limit_paths: 1,
    };
  } else if (item.query === 'not-reachable-from-onboarding') {
    return {
      settings,
      source: 'onboarding',
      target: slug,
      inverted: false,
      max_steps: null,
      offset_paths: 0,
      limit_paths: 1,
    };
  } else {
    return {
      settings,
      source: slug,
      inverted: true,
      max_steps: null,
      targets_cursor: null,
    };
  }
};

/** see WritableFlowDeletePrecheckItem */
export type FlowDeletePrecheckItem = {
  /** see WritableFlowDeletePrecheckItem */
  name: string;
  /** see WritableFlowDeletePrecheckItem */
  state: ValueWithCallbacks<'waiting' | 'loading' | 'success' | 'failed'>;
  /** see WritableFlowDeletePrecheckItem */
  message: ValueWithCallbacks<ReactElement | null>;
};

export type WritableFlowDeletePrecheckList = {
  /** the items to display in the list */
  items: WritableFlowDeletePrecheckItem[];

  /** how many are in the various states */
  counts: {
    waiting: WritableValueWithCallbacks<number>;
    loading: WritableValueWithCallbacks<number>;
    success: WritableValueWithCallbacks<number>;
    failed: WritableValueWithCallbacks<number>;
  };

  /** cancels any ongoing checks and prevents new ones from starting */
  cancel: () => void;
};

/** see WritableFlowDeletePrecheckList */
export type FlowDeletePrecheckList = {
  /** see WritableFlowDeletePrecheckList */
  items: FlowDeletePrecheckItem[];
  /** see WritableFlowDeletePrecheckList */
  counts: {
    waiting: ValueWithCallbacks<number>;
    loading: ValueWithCallbacks<number>;
    success: ValueWithCallbacks<number>;
    failed: ValueWithCallbacks<number>;
  };
  /** see WritableFlowDeletePrecheckList */
  cancel: () => void;
};

/**
 * Creates a new client flow delete precheck list, which runs various tests that
 * should pass before deleting a client flow (in most circumstances; an informed
 * user could still want to delete the flow and replace it with another with a
 * similar name, or delete this flow then delete/edit bunch of other flows
 * immediately following)
 */
export const createFlowDeletePrecheckList = (
  slug: string,
  user: LoginContextValueLoggedIn,
  maxConcurrent: number
): FlowDeletePrecheckList => {
  const counts = {
    waiting: createWritableValueWithCallbacks(0),
    loading: createWritableValueWithCallbacks(0),
    success: createWritableValueWithCallbacks(0),
    failed: createWritableValueWithCallbacks(0),
  } as const;

  const items: WritableFlowDeletePrecheckItem[] = [];
  const cleanup = new Callbacks<undefined>();
  for (let i = SCREEN_VERSION - 1; i <= SCREEN_VERSION + 1; i++) {
    for (const item of clientFlowAnalysisStandardEnvironments.flattened) {
      const environment = { ...item.environment, version: i };
      for (const query of QUERIES) {
        cleanup.add(
          ((precheckItem: WritableFlowDeletePrecheckItem) => {
            const cleanupCount = createValueWithCallbacksEffect(precheckItem.state, (s) => {
              const countVWC = counts[s];
              countVWC.set(countVWC.get() + 1);
              countVWC.callbacks.call(undefined);

              return () => {
                countVWC.set(countVWC.get() - 1);
                countVWC.callbacks.call(undefined);
              };
            });
            items.push(precheckItem);
            return cleanupCount;
          })({
            name: `${item.name} (v${i}) ${query}`,
            environment,
            query,
            state: createWritableValueWithCallbacks<'waiting' | 'loading' | 'success' | 'failed'>(
              'waiting'
            ),
            message: createWritableValueWithCallbacks<ReactElement | null>(null),
          })
        );
      }
    }
  }

  const active = createWritableValueWithCallbacks(true);
  const list: WritableFlowDeletePrecheckList = {
    items,
    counts,
    cancel: () => {
      setVWC(active, false);
      cleanup.call(undefined);
      cleanup.clear();
    },
  };
  drivePrecheckList(slug, user, list, active, maxConcurrent);
  return list;
};

const drivePrecheckList = async (
  slug: string,
  user: LoginContextValueLoggedIn,
  list: WritableFlowDeletePrecheckList,
  active: WritableValueWithCallbacks<boolean>,
  maxConcurrent: number
) => {
  if (maxConcurrent < 1) {
    throw new Error('maxConcurrent must be at least 1');
  }

  const notActive = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
  notActive.promise.catch(() => {});

  try {
    let startSearchIndex = 0;
    while (true) {
      if (!active.get()) {
        break;
      }

      const waiting = list.counts.waiting.get();
      if (waiting <= 0) {
        break;
      }

      const loading = list.counts.loading.get();
      if (loading >= maxConcurrent) {
        const canStartNext = waitForValueWithCallbacksConditionCancelable(
          list.counts.loading,
          (l) => l < maxConcurrent
        );
        canStartNext.promise.catch(() => {});
        const noneWaiting = waitForValueWithCallbacksConditionCancelable(
          list.counts.waiting,
          (w) => w <= 0
        );
        noneWaiting.promise.catch(() => {});
        await Promise.race([notActive.promise, canStartNext.promise, noneWaiting.promise]);
        canStartNext.cancel();
        noneWaiting.cancel();
        continue;
      }

      let toStart: WritableFlowDeletePrecheckItem | null = null;
      for (let i = startSearchIndex; i < list.items.length; i++) {
        const item = list.items[i];
        if (item.state.get() === 'waiting') {
          toStart = item;
          startSearchIndex = i;
          break;
        }
      }
      if (toStart === null) {
        for (let i = 0; i < startSearchIndex; i++) {
          const item = list.items[i];
          if (item.state.get() === 'waiting') {
            toStart = item;
            startSearchIndex = i;
            break;
          }
        }
      }

      if (toStart === null) {
        throw new Error('no item to start despite waiting count of ' + waiting);
      }

      const toStartNotWaiting = waitForValueWithCallbacksConditionCancelable(
        toStart.state,
        (s) => s !== 'waiting'
      );
      toStartNotWaiting.promise.catch(() => {});
      drivePrecheckItem(slug, user, toStart, active);
      await Promise.race([toStartNotWaiting.promise, notActive.promise]);
      toStartNotWaiting.cancel();
    }
  } finally {
    notActive.cancel();
  }
};

const drivePrecheckItem = async (
  slug: string,
  user: LoginContextValueLoggedIn,
  item: WritableFlowDeletePrecheckItem,
  active: WritableValueWithCallbacks<boolean>
) => {
  setVWC(item.state, 'loading');
  setVWC(item.message, null);
  const notActive = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
  notActive.promise.catch(() => {});

  try {
    for (let retry = 0; retry < 3; retry++) {
      if (retry > 0) {
        const timeout = createCancelableTimeout(1000 * Math.pow(2, retry) + 1000 * Math.random());
        timeout.promise.catch(() => {});
        await Promise.race([timeout.promise, notActive.promise]);
        timeout.cancel();
      }
      if (!active.get()) {
        setVWC(item.message, <>canceled</>);
        setVWC(item.state, 'failed');
        return;
      }
      const controller = new AbortController();
      const signal = controller.signal;
      notActive.promise.then(() => controller.abort());

      const response = await clientFlowsAnalyzeReachable(makeRequest(slug, item), user, { signal });
      if (!active.get()) {
        setVWC(item.message, <>canceled</>);
        setVWC(item.state, 'failed');
        return;
      }
      if (response.type === 'ratelimited') {
        continue;
      }
      if (response.type === 'no-paths') {
        setVWC(item.state, 'success');
        return;
      }
      if (Object.keys(response.result.items).length === 0) {
        setVWC(item.state, 'success');
        return;
      }
      setVWC(item.message, <>paths found</>);
      setVWC(item.state, 'failed');
      return;
    }
  } catch (e) {
    const described = await describeError(e);
    if (!active.get()) {
      setVWC(item.message, <>canceled</>);
      setVWC(item.state, 'failed');
      return;
    }
    setVWC(item.message, described);
    setVWC(item.state, 'failed');
  } finally {
    notActive.cancel();
  }
};

/**
 * Typically shown within a modal, this runs a series of checks to make sure
 * its safe to delete the client flow with the given slug, showing the results
 * to the user as they come in (or showing a loading state). The result of the
 * precheck does not prevent the user from deleting the flow - it's just informative.
 */
export const ClientFlowDeletePrechecks = ({
  uid,
  slug,
  onDeleted,
  onCanceled,
}: {
  /** the uid of the flow they are considering deleting */
  uid: string;
  /** the slug of the flow they are considering deleting */
  slug: string;
  /** callback after we have successfully deleted the flow */
  onDeleted: () => void;
  /** callback if the user doesn't want to delete the flow anymore */
  onCanceled: () => void;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const listVWC = useWritableValueWithCallbacks<FlowDeletePrecheckList | null>(() => null);
  useEffect(() => {
    const active = createWritableValueWithCallbacks(true);
    handle();
    return () => {
      setVWC(active, false);
    };

    async function handle() {
      const notActive = waitForValueWithCallbacksConditionCancelable(active, (a) => !a);
      notActive.promise.catch(() => {});

      const loggedIn = waitForValueWithCallbacksConditionCancelable(
        loginContextRaw.value,
        (l) => l.state === 'logged-in'
      );
      loggedIn.promise.catch(() => {});

      await Promise.race([notActive.promise, loggedIn.promise]);
      if (!active.get()) {
        loggedIn.cancel();
        return;
      }

      const user = await loggedIn.promise;
      if (!active.get() || user.state !== 'logged-in') {
        return;
      }

      const list = createFlowDeletePrecheckList(slug, user, 5);
      setVWC(listVWC, list);
      await notActive.promise;
      list.cancel();
      if (Object.is(listVWC.get(), list)) {
        listVWC.set(null);
        listVWC.callbacks.call(undefined);
      }
    }
  }, [slug]);

  const topLevelStateVWC = useWritableValueWithCallbacks(
    (): ReturnType<FlowDeletePrecheckItem['state']['get']> => 'loading'
  );
  useValueWithCallbacksEffect(listVWC, (listUnch) => {
    if (listUnch === null) {
      setVWC(topLevelStateVWC, 'loading');
      return undefined;
    }
    const list = listUnch;

    return createValuesWithCallbacksEffect(
      [list.counts.waiting, list.counts.loading, list.counts.success, list.counts.failed],
      () => {
        const waiting = list.counts.waiting.get();
        const loading = list.counts.loading.get();
        const failed = list.counts.failed.get();

        if (failed > 0) {
          setVWC(topLevelStateVWC, 'failed');
          return undefined;
        }

        if (waiting > 0 || loading > 0) {
          setVWC(topLevelStateVWC, 'loading');
          return undefined;
        }

        setVWC(topLevelStateVWC, 'success');
        return undefined;
      }
    );
  });

  const workingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const topLevelErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  return (
    <div className={styles.column}>
      <div className={styles.row}>
        <RenderGuardedComponent
          props={topLevelStateVWC}
          component={(s) => <StateIcon state={s} />}
        />
        <HorizontalSpacer width={8} />
        <div className={styles.title}>Delete Prechecks for {slug}</div>
      </div>
      <VerticalSpacer height={12} />
      <RenderGuardedComponent
        props={listVWC}
        component={(list) => {
          if (list === null) {
            return <div className={styles.message}>Initializing...</div>;
          }

          const elements: ReactElement[] = [];
          list.items.forEach((item, index) => {
            if (index > 0) {
              elements.push(<VerticalSpacer height={8} key={elements.length} />);
            }
            elements.push(
              <div key={elements.length} className={styles.column}>
                <div className={styles.row}>
                  <RenderGuardedComponent
                    props={item.state}
                    component={(s) => <StateIcon state={s} />}
                  />
                  <HorizontalSpacer width={8} />
                  <div className={styles.name}>{item.name}</div>
                </div>
                <RenderGuardedComponent
                  props={item.message}
                  component={(m) =>
                    m === null ? <></> : <div className={styles.message}>{m}</div>
                  }
                />
              </div>
            );
          });
          return <div className={styles.list}>{elements}</div>;
        }}
      />
      <VerticalSpacer height={40} />
      <Button
        type="button"
        variant="outlined-danger"
        onClick={(e) => {
          e.preventDefault();
          screenWithWorking(workingVWC, async () => {
            const loginContextUnch = loginContextRaw.value.get();
            if (loginContextUnch.state !== 'logged-in') {
              setVWC(topLevelErrorVWC, <>not logged in</>);
              return;
            }
            const user = loginContextUnch;
            setVWC(topLevelErrorVWC, null);
            try {
              const response = await apiFetch(
                '/api/1/client_flows/' + uid,
                {
                  method: 'DELETE',
                },
                user
              );
              if (!response.ok) {
                throw response;
              }
              setVWC(topLevelErrorVWC, <>Deleted</>);
              onDeleted();
            } catch (e) {
              setVWC(topLevelErrorVWC, await describeError(e));
              return;
            }
          });
        }}>
        Delete
      </Button>
      <VerticalSpacer height={16} />
      <Button
        type="button"
        variant="outlined"
        onClick={(e) => {
          e.preventDefault();
          screenWithWorking(workingVWC, async () => {
            onCanceled();
          });
        }}>
        Cancel Delete
      </Button>
      <RenderGuardedComponent
        props={topLevelErrorVWC}
        component={(e) => (e === null ? <></> : <ErrorBlock>{e}</ErrorBlock>)}
      />
    </div>
  );
};

/**
 * Shows the prechecks with buttons to delete or cancel, or they can click outside
 * the modal to cancel. Returns true if the client flow was deleted, false if they
 * explicitly canceled, and null if they clicked outside the modal.
 */
export const handleClientFlowDeleteWithPopup = ({
  modals,
  uid,
  slug,
}: {
  modals: WritableValueWithCallbacks<Modals>;
  uid: string;
  slug: string;
}): CancelablePromise<boolean | null> => {
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

      let resolveDismissed = () => {};
      const dismissed = new Promise<void>((resolve) => {
        resolveDismissed = resolve;
      });

      let answer: boolean | null = null;

      const closeModal = addModalWithCallbackToRemove(
        modals,
        <ModalWrapper
          onClosed={() => {
            closeModal();
            resolveDismissed();
          }}>
          <ClientFlowDeletePrechecks
            uid={uid}
            slug={slug}
            onDeleted={() => {
              answer = true;
              closeModal();
              resolveDismissed();
            }}
            onCanceled={() => {
              answer = false;
              closeModal();
              resolveDismissed();
            }}
          />
        </ModalWrapper>
      );

      await Promise.race([dismissed, canceled.promise]);

      if (state.finishing) {
        resolveDismissed();
        closeModal();
        state.done = true;
        reject(new Error('canceled'));
        return;
      }

      state.finishing = true;
      state.done = true;
      resolve(answer);
    },
  });
};

const StateIcon = ({
  state,
}: {
  state: 'waiting' | 'loading' | 'success' | 'failed';
}): ReactElement => {
  if (state === 'waiting') {
    return (
      <div
        style={{
          fontSize: '16px',
          lineHeight: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        ⏱
      </div>
    );
  }
  if (state === 'loading') {
    return (
      <InlineOsehSpinner
        size={{
          type: 'react-rerender',
          props: {
            height: 16,
          },
        }}
        variant="black"
      />
    );
  }
  if (state === 'success') {
    return (
      <Check
        icon={{
          height: 16,
        }}
        container={{
          width: 16,
          height: 16,
        }}
        startPadding={{
          x: {
            fraction: 0.5,
          },
          y: {
            fraction: 0.5,
          },
        }}
        color={OsehColors.v4.primary.dark}
      />
    );
  }
  return (
    <Close
      icon={{
        height: 16,
      }}
      container={{
        width: 16,
        height: 16,
      }}
      startPadding={{
        x: {
          fraction: 0.5,
        },
        y: {
          fraction: 0.5,
        },
      }}
      color={OsehColors.v4.other.red}
    />
  );
};
