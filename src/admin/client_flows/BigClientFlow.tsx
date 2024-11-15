import { ReactElement, useContext, useEffect } from 'react';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/contexts/ModalContext';
import {
  WritableValueWithTypedCallbacks,
  createWritableValueWithCallbacks,
  downgradeTypedVWC,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { ClientFlow, clientFlowKeyMap } from './ClientFlow';
import { adaptActiveVWCToAbortSignal } from '../../shared/lib/adaptActiveVWCToAbortSignal';
import { apiFetch } from '../../shared/ApiConstants';
import { CrudFetcherFilter, convertUsingMapper } from '../crud/CrudFetcher';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../shared/lib/setVWC';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import styles from './BigClientFlow.module.css';
import { CrudFormElement } from '../crud/CrudFormElement';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { createSaveable, useSaveable } from '../../shared/models/Saveable';
import { constructCancelablePromise } from '../../shared/lib/CancelablePromiseConstructor';
import { adaptCallbacksToAbortSignal } from '../../shared/lib/adaptCallbacksToAbortSignal';
import { LoginContext } from '../../shared/contexts/LoginContext';
import {
  ClientFlowScreen,
  ClientFlowScreenFlag,
  serializeClientFlowScreen,
} from './client_flow_screens/ClientFlowScreen';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { ClientFlowFlags } from './ClientFlowFlags';
import { TextInput } from '../../shared/forms/TextInput';
import { CrudSwappableElement } from '../lib/CrudSwappableElement';
import { OpenAPIEditableSchema, OpenAPISchemaEditor } from '../crud/schema/OpenAPISchemaEditor';
import { OpenAPISchemaViewer } from '../crud/schema/OpenAPISchemaViewer';
import { Checkbox } from '../../shared/forms/Checkbox';
import { FLAG_NAMES } from './ClientFlowFilterAndSortBlock';
import { showYesNoModal } from '../../shared/lib/showYesNoModal';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { Button } from '../../shared/forms/Button';
import { DraggableTable, DraggableTableMutationEvent } from './components/DraggableTable';
import { createUID } from '../../shared/lib/createUID';
import { showClientFlowScreenEditor } from './client_flow_screens/showClientFlowScreenEditor';
import { showUserPicker } from '../users/showUserPicker';
import { showTextInputModal } from '../../shared/components/showTextInputModal';
import {
  UserFilterAndSortBlock,
  defaultFilter,
  defaultSort,
} from '../users/UserFilterAndSortBlock';
import { adaptValueWithCallbacksAsSetState } from '../../shared/lib/adaptValueWithCallbacksAsSetState';
import { createCancelablePromiseFromCallbacks } from '../../shared/lib/createCancelablePromiseFromCallbacks';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { WorkingOverlay } from '../../shared/components/WorkingOverlay';
import { VerticalSpacer } from '../../shared/components/VerticalSpacer';
import { ClientFlowRule, serializeClientFlowRule } from './client_flow_screens/ClientFlowRule';
import { ClientFlowAnalysis } from './analysis/ClientFlowAnalysis';
import { AdminDashboardLargeChartPlaceholder } from '../dashboard/AdminDashboardLargeChartPlaceholder';
import { screenWithWorking } from '../../user/core/lib/screenWithWorking';
import { handleClientFlowDeleteWithPopup } from './analysis/ClientFlowDeletePrechecks';
import { chooseErrorFromStatus, DisplayableError } from '../../shared/lib/errors';

/**
 * Shows detailed information about a specific client flow specified by the slug in the URL
 */
export const BigClientFlow = (): ReactElement => {
  const modalContext = useContext(ModalContext);
  const slugVWC = useWritableValueWithCallbacks(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug');
  });
  const clientFlowNR = useNetworkResponse<ClientFlow>(
    (active, ctx) =>
      adaptActiveVWCToAbortSignal(active, async (signal): Promise<ClientFlow | null> => {
        const response = await apiFetch(
          '/api/1/client_flows/search',
          {
            method: 'POST',
            signal,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              filters: {
                slug: {
                  operator: 'eq',
                  value: slugVWC.get(),
                },
              },
              limit: 1,
              include_messages: true,
            }),
          },
          ctx
        );
        if (!response.ok) {
          throw response;
        }
        const data: { items: any[] } = await response.json();
        if (data.items.length === 0) {
          return null;
        }

        return convertUsingMapper(data.items[0], clientFlowKeyMap);
      }),
    {
      dependsOn: [slugVWC],
    }
  );
  const clientFlowNRPopupErrorVWC = useWritableValueWithCallbacks<DisplayableError | null>(
    () => null
  );
  useValueWithCallbacksEffect(clientFlowNR, (cf) => {
    setVWC(clientFlowNRPopupErrorVWC, cf.error);
    return undefined;
  });
  useErrorModal(modalContext.modals, clientFlowNRPopupErrorVWC);

  return (
    <div className={styles.container}>
      <div className={styles.title}>Client Flow</div>

      <RenderGuardedComponent
        props={clientFlowNR}
        component={(cf) =>
          cf.type !== 'success' ? <></> : <Inner initialClientFlow={cf.result} />
        }
      />
    </div>
  );
};

const Inner = ({ initialClientFlow }: { initialClientFlow: ClientFlow }): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);

  const screensFastTWVWC = useWritableValueWithCallbacks<ClientFlowScreen[]>(() => [
    ...initialClientFlow.screens,
  ]) as WritableValueWithTypedCallbacks<
    ClientFlowScreen[],
    DraggableTableMutationEvent<ClientFlowScreen> | undefined
  >;

  const clientFlowSaveable = useSaveable({
    initial: initialClientFlow,
    beforeSave: (flow) => {
      return {
        ...flow,
        screens: [...screensFastTWVWC.get()],
      };
    },
    save: (flow, oldFlow) =>
      constructCancelablePromise({
        body: async (state, resolve, reject) => {
          try {
            await adaptCallbacksToAbortSignal(state.cancelers, async (signal) => {
              if (state.finishing) {
                state.done = true;
                reject(new Error('canceled'));
                return;
              }

              const loginContext = loginContextRaw.value.get();
              if (loginContext.state !== 'logged-in') {
                throw new Error('not logged in');
              }

              const response = await apiFetch(
                '/api/1/client_flows/',
                {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                  },
                  body: JSON.stringify({
                    uid: flow.uid,
                    precondition: {
                      slug: oldFlow.slug,
                      name: oldFlow.name ?? null,
                      description: oldFlow.description ?? null,
                      client_schema: oldFlow.clientSchema,
                      server_schema: oldFlow.serverSchema,
                      replaces: oldFlow.replaces,
                      screens: oldFlow.screens.map((s) => serializeClientFlowScreen(s)),
                      rules: oldFlow.rules.map((s) => serializeClientFlowRule(s)),
                      flags: oldFlow.flags,
                    },
                    patch: {
                      slug: flow.slug,
                      name: flow.name ?? null,
                      description: flow.description ?? null,
                      client_schema: flow.clientSchema,
                      server_schema: flow.serverSchema,
                      replaces: flow.replaces,
                      screens: flow.screens.map((s) => serializeClientFlowScreen(s)),
                      rules: flow.rules.map((s) => serializeClientFlowRule(s)),
                      flags: flow.flags,
                    },
                  }),
                  signal,
                },
                loginContext
              );

              if (!response.ok) {
                throw response;
              }

              const raw = await response.json();
              const parsed = convertUsingMapper(raw, clientFlowKeyMap);

              state.finishing = true;
              state.done = true;
              resolve(parsed);
            });
          } catch (e) {
            state.finishing = true;
            state.done = true;
            reject(e);
          }
        },
      }),
  });

  const saveableErrorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  useValueWithCallbacksEffect(clientFlowSaveable.state, (s) => {
    if (s.type === 'error') {
      setVWC(saveableErrorVWC, s.error);
    } else {
      setVWC(saveableErrorVWC, null);
    }
    return undefined;
  });
  useErrorModal(modalContext.modals, saveableErrorVWC);

  const draftVWC = useMappedValueWithCallbacks(clientFlowSaveable.state, (s) =>
    s.type === 'error' ? s.erroredValue : s.value
  );
  const isCustomVWC = useMappedValueWithCallbacks(
    draftVWC,
    (v) => (v.flags & ClientFlowFlags.IS_CUSTOM) !== 0
  );
  const slugVWC = useMappedValueWithCallbacks(draftVWC, (v) => v.slug);

  const canonicalClientSchemaVWC = useMappedValueWithCallbacks(draftVWC, (v) => ({
    source: JSON.stringify(v.clientSchema, null, 2),
    parsed: v.clientSchema,
  }));
  const clientSchemaVWC = useWritableValueWithCallbacks<OpenAPIEditableSchema>(() => ({
    type: 'parsed',
    source: canonicalClientSchemaVWC.get().source,
    parsed: canonicalClientSchemaVWC.get().parsed,
  }));
  useValueWithCallbacksEffect(clientSchemaVWC, (v) => {
    if (v.type === 'parsed' && v.source !== canonicalClientSchemaVWC.get().source) {
      clientFlowSaveable.onClientChange({
        ...draftVWC.get(),
        clientSchema: v.parsed,
      });
    }
    return undefined;
  });

  const canonicalServerSchemaVWC = useMappedValueWithCallbacks(draftVWC, (v) => ({
    source: JSON.stringify(v.serverSchema, null, 2),
    parsed: v.serverSchema,
  }));
  const serverSchemaVWC = useWritableValueWithCallbacks<OpenAPIEditableSchema>(() => ({
    type: 'parsed',
    source: canonicalServerSchemaVWC.get().source,
    parsed: canonicalServerSchemaVWC.get().parsed,
  }));
  useValueWithCallbacksEffect(serverSchemaVWC, (v) => {
    if (v.type === 'parsed' && v.source !== canonicalServerSchemaVWC.get().source) {
      clientFlowSaveable.onClientChange({
        ...draftVWC.get(),
        serverSchema: v.parsed,
      });
    }
    return undefined;
  });

  const flagsVWC = useMappedValueWithCallbacks(draftVWC, (v) => v.flags);
  const canonicalRulesVWC = useMappedValueWithCallbacks(draftVWC, (v) => ({
    source: JSON.stringify(v.rules, null, 2),
    parsed: v.rules,
  }));
  const rulesVWC = useWritableValueWithCallbacks<OpenAPIEditableSchema>(() => ({
    type: 'parsed',
    source: canonicalRulesVWC.get().source,
    parsed: canonicalRulesVWC.get().parsed,
  }));
  useValueWithCallbacksEffect(rulesVWC, (v) => {
    if (v.type === 'parsed' && v.source !== canonicalRulesVWC.get().source) {
      clientFlowSaveable.onClientChange({
        ...draftVWC.get(),
        rules: v.parsed as ClientFlowRule[],
      });
    }
    return undefined;
  });

  const draftStateVWC = useMappedValueWithCallbacks(clientFlowSaveable.state, (s) => s.type);
  useEffect(() => {
    screensFastTWVWC.callbacks.add(onUpdate);
    return () => {
      screensFastTWVWC.callbacks.remove(onUpdate);
    };

    function onUpdate() {
      clientFlowSaveable.onClientFastChange();
    }
  }, [clientFlowSaveable, screensFastTWVWC]);
  const workingVWC = useWritableValueWithCallbacks(() => false);

  const testErrorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  useErrorModal(modalContext.modals, testErrorVWC);

  const testFlow = async (dryRun: boolean, userSub?: string) => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      setVWC(workingVWC, false);
      return;
    }

    const loginContext = loginContextUnch;
    const draft = draftVWC.get();
    const action = 'test flow';
    try {
      let response: Response;
      try {
        response = await apiFetch(
          '/api/1/client_flows/test_flow',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              slug: slugVWC.get(),
              client_parameters: draft.clientSchema.example,
              server_parameters: draft.serverSchema.example,
              dry_run: dryRun,
              ...(userSub !== undefined ? { user_sub: userSub } : {}),
            }),
          },
          loginContext
        );
      } catch (e) {
        setVWC(testErrorVWC, new DisplayableError('connectivity', action));
        return;
      }

      if (!response.ok) {
        setVWC(testErrorVWC, chooseErrorFromStatus(response.status, action));
        return;
      }

      await showYesNoModal(modalContext.modals, {
        title: 'Success',
        body: 'The flow has been triggered on your client',
        cta1: 'Okay',
        emphasize: 1,
      }).promise;
    } catch (e) {
      setVWC(testErrorVWC, new DisplayableError('client', action, `${e}`));
    } finally {
      setVWC(workingVWC, false);
    }
  };

  const cloneErrorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  useErrorModal(modalContext.modals, cloneErrorVWC);

  const showingAnalysisVWC = useWritableValueWithCallbacks(() => false);

  return (
    <>
      <div className={styles.row}>
        <div className={styles.basic}>
          <CrudSwappableElement
            version={isCustomVWC}
            truthy={() => (
              <RenderGuardedComponent
                props={slugVWC}
                component={(slug) => (
                  <TextInput
                    type="text"
                    inputStyle="normal"
                    value={slug}
                    onChange={(v) =>
                      clientFlowSaveable.onClientChange({
                        ...draftVWC.get(),
                        slug: v,
                      })
                    }
                    html5Validation={null}
                    label="Slug"
                    disabled={false}
                    help={
                      <>
                        Semantic identifier for this flow. Changing this value is extremely
                        significant: references to this flow in the client will not be updated
                        automatically.
                      </>
                    }
                  />
                )}
                applyInstantly
              />
            )}
            falsey={() => (
              <CrudFormElement title="slug" noTopMargin>
                <RenderGuardedComponent props={slugVWC} component={(s) => <>{s}</>} />
              </CrudFormElement>
            )}
          />
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(draftVWC, (v) => v.name)}
            component={(name) => (
              <TextInput
                label="Name"
                type="text"
                inputStyle="normal"
                value={name ?? ''}
                onChange={(v) =>
                  clientFlowSaveable.onClientChange({
                    ...draftVWC.get(),
                    name: v === '' ? null : v,
                  })
                }
                html5Validation={null}
                disabled={false}
                help={null}
              />
            )}
            applyInstantly
          />
          <CrudFormElement title="Description" noTopMargin>
            <RenderGuardedComponent
              props={useMappedValueWithCallbacks(draftVWC, (v) => v.description)}
              component={(description) => (
                <textarea
                  value={description ?? ''}
                  onChange={(e) => {
                    const newValue = e.target.value === '' ? null : e.target.value;
                    clientFlowSaveable.onClientChange({ ...draftVWC.get(), description: newValue });
                  }}
                  className={styles.description}
                />
              )}
              applyInstantly
            />
          </CrudFormElement>
          <CrudFormElement title="Client Schema" noTopMargin>
            <CrudSwappableElement
              version={isCustomVWC}
              truthy={() => <OpenAPISchemaEditor schema={clientSchemaVWC} />}
              falsey={() => <OpenAPISchemaViewer schema={canonicalClientSchemaVWC} />}
            />
          </CrudFormElement>
          <CrudFormElement title="Server Schema" noTopMargin>
            <CrudSwappableElement
              version={isCustomVWC}
              truthy={() => <OpenAPISchemaEditor schema={serverSchemaVWC} />}
              falsey={() => <OpenAPISchemaViewer schema={canonicalServerSchemaVWC} />}
            />
          </CrudFormElement>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(draftVWC, (v) => ({
              value: v.replaces,
              disabled: (v.flags & ClientFlowFlags.IS_CUSTOM) === 0,
            }))}
            component={({ value, disabled }) => (
              <Checkbox
                label="Replaces"
                value={value}
                disabled={disabled}
                setValue={(v) => {
                  clientFlowSaveable.onClientChange({ ...draftVWC.get(), replaces: v });
                }}
              />
            )}
            applyInstantly
          />
          <CrudFormElement title="Flags" noTopMargin>
            <RenderGuardedComponent
              props={isCustomVWC}
              component={(isCustom) => (
                <RenderGuardedComponent
                  props={flagsVWC}
                  component={(flag) => (
                    <div className={styles.checks}>
                      {FLAG_NAMES.map(([flagValue, name]) => (
                        <Checkbox
                          key={flagValue}
                          value={(flag & flagValue) !== 0}
                          setValue={async (checked) => {
                            const newFlag = checked ? flag | flagValue : flag & ~flagValue;

                            if (newFlag === flag) {
                              return;
                            }

                            if (flagValue === ClientFlowFlags.IS_CUSTOM && checked) {
                              const confirmation = await showYesNoModal(modalContext.modals, {
                                title: 'Change Editability',
                                body: 'This flow may have special significance. Are you sure you want to allow editing?',
                                cta1: 'Yes, allow editing',
                                cta2: 'No, cancel',
                                emphasize: 2,
                              }).promise;
                              if (!confirmation) {
                                return;
                              }
                            }

                            clientFlowSaveable.onClientChange({
                              ...draftVWC.get(),
                              flags: newFlag,
                            });
                          }}
                          label={name}
                          disabled={!isCustom && flagValue !== ClientFlowFlags.IS_CUSTOM}
                        />
                      ))}
                    </div>
                  )}
                />
              )}
            />
          </CrudFormElement>
          <CrudFormElement title="Rules" noTopMargin>
            <CrudSwappableElement
              version={isCustomVWC}
              truthy={() => <OpenAPISchemaEditor schema={rulesVWC} />}
              falsey={() => <OpenAPISchemaViewer schema={canonicalRulesVWC} />}
            />
          </CrudFormElement>
        </div>
        <div className={styles.screens}>
          <div className={styles.screensTitle}>Screens</div>
          <RenderGuardedComponent
            props={useMappedValueWithCallbacks(downgradeTypedVWC(screensFastTWVWC), (screens) => ({
              platforms: screens.some(
                (s) =>
                  (s.flags &
                    (ClientFlowScreenFlag.SHOWS_ON_IOS |
                      ClientFlowScreenFlag.SHOWS_ON_ANDROID |
                      ClientFlowScreenFlag.SHOWS_ON_WEB)) !==
                  (ClientFlowScreenFlag.SHOWS_ON_IOS |
                    ClientFlowScreenFlag.SHOWS_ON_ANDROID |
                    ClientFlowScreenFlag.SHOWS_ON_WEB)
              ),
              proStatus: screens.some(
                (s) =>
                  (s.flags &
                    (ClientFlowScreenFlag.SHOWS_FOR_FREE | ClientFlowScreenFlag.SHOWS_FOR_PRO)) !==
                  (ClientFlowScreenFlag.SHOWS_FOR_FREE | ClientFlowScreenFlag.SHOWS_FOR_PRO)
              ),
            }))}
            component={({ platforms, proStatus }) => (
              <DraggableTable
                key={(platforms ? 1 : 0) | (proStatus ? 2 : 0)}
                thead={
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      {platforms && (
                        <>
                          <th scope="col">iOS</th>
                          <th scope="col">Android</th>
                          <th scope="col">Web</th>
                        </>
                      )}
                      {proStatus && (
                        <>
                          <th scope="col">Free</th>
                          <th scope="col">Pro</th>
                        </>
                      )}
                    </tr>
                  </thead>
                }
                items={screensFastTWVWC}
                render={renderScreenRow.bind(undefined, platforms, proStatus)}
                keyFn={screenKeyFn}
                onExpandRow={async (item) => {
                  const index = screensFastTWVWC
                    .get()
                    .findIndex((x) => x.clientSideUid === item.clientSideUid);
                  const saveable = createSaveable({
                    initial: item,
                    beforeSave: (screen) => screen,
                    save: (screen) => {
                      const screens = screensFastTWVWC.get();
                      const original = screens[index];
                      screens[index] = screen;
                      screensFastTWVWC.callbacks.call({
                        type: 'replace',
                        index,
                        original,
                        replaced: screen,
                      });
                      return {
                        promise: Promise.resolve(screen),
                        cancel: () => {},
                        done: () => true,
                      };
                    },
                  });
                  let onDelete = () => {};
                  const popup = showClientFlowScreenEditor(
                    modalContext.modals,
                    draftVWC,
                    saveable,
                    () => onDelete()
                  );
                  onDelete = () => {
                    popup.cancel();
                    screensFastTWVWC.get().splice(index, 1);
                    screensFastTWVWC.callbacks.call({
                      type: 'remove',
                      index,
                      item,
                    });
                  };
                }}
              />
            )}
          />
          <Button
            type="button"
            variant="outlined"
            onClick={(e) => {
              e.preventDefault();
              const newScreen: ClientFlowScreen = {
                clientSideUid: createUID(),
                screen: {
                  slug: 'confirmation',
                  fixed: {
                    header: 'Hey there',
                    message: 'This is a new screen',
                  },
                  variable: [],
                },
                allowedTriggers: [],
                rules: { trigger: null, peek: null },
                flags:
                  ClientFlowScreenFlag.SHOWS_ON_IOS |
                  ClientFlowScreenFlag.SHOWS_ON_ANDROID |
                  ClientFlowScreenFlag.SHOWS_ON_WEB |
                  ClientFlowScreenFlag.SHOWS_FOR_FREE |
                  ClientFlowScreenFlag.SHOWS_FOR_PRO,
              };
              screensFastTWVWC.get().push(newScreen);
              screensFastTWVWC.callbacks.call({
                type: 'add',
                item: newScreen,
                index: screensFastTWVWC.get().length - 1,
              });
            }}>
            Add Screen
          </Button>
        </div>
        <div className={styles.controls}>
          <RenderGuardedComponent
            props={useMappedValuesWithCallbacks([draftStateVWC, workingVWC], () => ({
              disabled: draftStateVWC.get() === 'ready',
              spinner: workingVWC.get(),
            }))}
            component={({ disabled, spinner }) => (
              <Button
                type="button"
                variant="filled-premium"
                onClick={async (e) => {
                  e.preventDefault();
                  setVWC(workingVWC, true);
                  try {
                    await clientFlowSaveable.requestImmediateSave();
                  } finally {
                    setVWC(workingVWC, false);
                  }
                }}
                disabled={disabled}
                spinner={spinner}>
                Save
              </Button>
            )}
          />
          <RenderGuardedComponent
            props={useMappedValuesWithCallbacks([draftStateVWC, workingVWC], () => ({
              disabled: draftStateVWC.get() !== 'ready',
              spinner: workingVWC.get(),
            }))}
            component={({ disabled, spinner }) => (
              <>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={async (e) => {
                    e.preventDefault();
                    setVWC(workingVWC, true);
                    testFlow(false);
                  }}
                  disabled={disabled}
                  spinner={spinner}>
                  Trigger on Self
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={async (e) => {
                    e.preventDefault();
                    setVWC(workingVWC, true);

                    const targetUser = await showUserPicker({ modals: modalContext.modals })
                      .promise;
                    if (targetUser === null) {
                      setVWC(workingVWC, false);
                    } else {
                      testFlow(false, targetUser.sub);
                    }
                  }}
                  disabled={disabled}
                  spinner={spinner}>
                  Trigger on Other
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={async (e) => {
                    e.preventDefault();
                    const loginContext = loginContextRaw.value.get();
                    if (loginContext.state !== 'logged-in') {
                      return;
                    }

                    setVWC(workingVWC, true);
                    setVWC(cloneErrorVWC, null);
                    try {
                      const slug = await showTextInputModal({
                        modals: modalContext.modals,
                        props: {
                          label: 'Slug',
                          help: 'The slug for the new flow',
                          html5Validation: {
                            minLength: 1,
                            pattern: '^[a-z0-9_-]+$',
                          },
                        },
                      }).promise;

                      // check it doesn't already exist before prompting to confirm
                      const response = await apiFetch(
                        '/api/1/client_flows/search',
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
                        },
                        loginContext
                      );
                      if (!response.ok) {
                        throw response;
                      }
                      const data: { items: any[] } = await response.json();
                      if (data.items.length > 0) {
                        setVWC(
                          cloneErrorVWC,
                          new DisplayableError(
                            'server-not-retryable',
                            'creating flow',
                            'a flow with this slug already exists'
                          )
                        );
                        return;
                      }

                      const confirmation = await showYesNoModal(modalContext.modals, {
                        title: 'Clone Flow',
                        body: `Are you sure you want to clone this flow, creating a new flow with the slug ${slug}?`,
                        cta1: 'Yes, clone',
                        cta2: 'No, cancel',
                        emphasize: 1,
                      }).promise;
                      if (!confirmation) {
                        return;
                      }

                      const createResponse = await apiFetch(
                        '/api/1/client_flows/',
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                          },
                          body: JSON.stringify({ slug }),
                        },
                        loginContext
                      );
                      if (!createResponse.ok) {
                        throw createResponse;
                      }
                      const createData = await createResponse.json();
                      const initialFlow = convertUsingMapper(createData, clientFlowKeyMap);
                      const patchResponse = await apiFetch(
                        '/api/1/client_flows/',
                        {
                          method: 'PATCH',
                          headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                          },
                          body: JSON.stringify({
                            uid: initialFlow.uid,
                            precondition: {
                              slug: initialFlow.slug,
                            },
                            patch: {
                              name: draftVWC.get().name + ' [CLONED]',
                              description: draftVWC.get().description,
                              client_schema: draftVWC.get().clientSchema,
                              server_schema: draftVWC.get().serverSchema,
                              replaces: draftVWC.get().replaces,
                              screens: draftVWC
                                .get()
                                .screens.map((s) => serializeClientFlowScreen(s)),
                              rules: draftVWC.get().rules.map((s) => serializeClientFlowRule(s)),
                              flags: draftVWC.get().flags,
                            },
                          }),
                        },
                        loginContext
                      );
                      if (!patchResponse.ok) {
                        throw patchResponse;
                      }
                      const confirmation2 = await showYesNoModal(modalContext.modals, {
                        title: 'Go to cloned flow?',
                        body: 'The flow has been cloned successfully. Do you want to be redirected there now?',
                        cta1: 'Yes, go to flow',
                        cta2: 'No, stay here',
                        emphasize: 1,
                      }).promise;
                      if (confirmation2) {
                        window.location.href = `/admin/client_flow?slug=${slug}`;
                      }
                    } catch (e) {
                      setVWC(
                        cloneErrorVWC,
                        e instanceof DisplayableError
                          ? e
                          : new DisplayableError('client', 'create flow', `${e}`)
                      );
                    } finally {
                      setVWC(workingVWC, false);
                    }
                  }}
                  disabled={disabled}
                  spinner={spinner}>
                  Clone Flow
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={disabled}
                  spinner={spinner}
                  onClick={async (e) => {
                    e.preventDefault();
                    const loginContext = loginContextRaw.value.get();
                    if (loginContext.state !== 'logged-in') {
                      return;
                    }
                    setVWC(workingVWC, true);

                    try {
                      const filterVWC =
                        createWritableValueWithCallbacks<CrudFetcherFilter>(defaultFilter);
                      const confirmed = createWritableValueWithCallbacks(false);
                      const cancelled = createWritableValueWithCallbacks(false);
                      const confirmedCancelable = createCancelablePromiseFromCallbacks(
                        confirmed.callbacks
                      );
                      confirmedCancelable.promise.catch(() => {});
                      const cancelledCancelable = createCancelablePromiseFromCallbacks(
                        cancelled.callbacks
                      );
                      cancelledCancelable.promise.catch(() => {});
                      const removeModal = addModalWithCallbackToRemove(
                        modalContext.modals,
                        <ModalWrapper
                          onClosed={() => {
                            setVWC(cancelled, true);
                          }}>
                          <div style={{ padding: '24px', maxWidth: 'min(80vw, 600px)' }}>
                            <p style={{ fontFamily: "'Open Sans', sans-serif" }}>
                              Select the filters in the same way you filter users, then this will
                              trigger this flow on everyone matching the filters. It will post
                              progress to the #ops channel, and when done it will post to the
                              #oseh-bot channel. Ignore the sort select, it will not be used.
                            </p>
                            <VerticalSpacer height={24} />
                            <RenderGuardedComponent
                              props={filterVWC}
                              component={(filter) => (
                                <UserFilterAndSortBlock
                                  sort={defaultSort}
                                  setSort={() => {}}
                                  filter={filter}
                                  setFilter={adaptValueWithCallbacksAsSetState(filterVWC)}
                                />
                              )}
                            />
                            <VerticalSpacer height={24} />
                            <Button
                              type="button"
                              variant="outlined-danger"
                              onClick={(e) => {
                                e.preventDefault();
                                setVWC(confirmed, true);
                              }}
                              fullWidth>
                              Trigger
                            </Button>
                          </div>
                        </ModalWrapper>
                      );
                      await Promise.race([
                        confirmedCancelable.promise,
                        cancelledCancelable.promise,
                      ]);
                      confirmedCancelable.cancel();
                      cancelledCancelable.cancel();
                      removeModal();
                      if (cancelled.get()) {
                        return;
                      }
                      const removeOverlay = addModalWithCallbackToRemove(
                        modalContext.modals,
                        <WorkingOverlay />
                      );
                      try {
                        const response = await apiFetch(
                          '/api/1/client_flows/oneoff_flow',
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json; charset=utf-8',
                            },
                            body: JSON.stringify({
                              slug: slugVWC.get(),
                              client_parameters: draftVWC.get().clientSchema.example,
                              server_parameters: draftVWC.get().serverSchema.example,
                              filters: filterVWC.get(),
                            }),
                            keepalive: true,
                          },
                          loginContext
                        );
                        if (!response.ok) {
                          throw response;
                        }
                      } catch (e) {
                        setVWC(testErrorVWC, new DisplayableError('connectivity', 'trigger flow'));
                      } finally {
                        removeOverlay();
                      }
                    } finally {
                      setVWC(workingVWC, false);
                    }
                  }}>
                  Trigger on Many
                </Button>
                <Button
                  type="button"
                  variant="outlined-danger"
                  disabled={disabled}
                  spinner={spinner}
                  onClick={async (e) => {
                    e.preventDefault();
                    screenWithWorking(workingVWC, async () => {
                      const result = await handleClientFlowDeleteWithPopup({
                        modals: modalContext.modals,
                        uid: draftVWC.get().uid,
                        slug: draftVWC.get().slug,
                      }).promise;
                      if (result) {
                        window.location.href = '/admin/client_flows';
                      }
                    });
                  }}>
                  Delete Flow
                </Button>
              </>
            )}
          />
        </div>
        <RenderGuardedComponent
          props={showingAnalysisVWC}
          component={(showing) =>
            showing ? (
              <RenderGuardedComponent
                props={slugVWC}
                component={(slug) => <ClientFlowAnalysis slug={slug} />}
              />
            ) : (
              <AdminDashboardLargeChartPlaceholder
                onVisible={() => setVWC(showingAnalysisVWC, true)}
              />
            )
          }
        />
      </div>
    </>
  );
};

const renderScreenRow = (
  platforms: boolean,
  proStatus: boolean,
  item: ClientFlowScreen
): ReactElement => {
  const yes = '✓';
  const no = '✗';
  return (
    <>
      <td>{item.name ?? item.screen.slug}</td>
      {platforms && (
        <>
          <td>{(item.flags & ClientFlowScreenFlag.SHOWS_ON_IOS) !== 0 ? yes : no}</td>
          <td>{(item.flags & ClientFlowScreenFlag.SHOWS_ON_ANDROID) !== 0 ? yes : no}</td>
          <td>{(item.flags & ClientFlowScreenFlag.SHOWS_ON_WEB) !== 0 ? yes : no}</td>
        </>
      )}
      {proStatus && (
        <>
          <td>{(item.flags & ClientFlowScreenFlag.SHOWS_FOR_FREE) !== 0 ? yes : no}</td>
          <td>{(item.flags & ClientFlowScreenFlag.SHOWS_FOR_PRO) !== 0 ? yes : no}</td>
        </>
      )}
    </>
  );
};

const screenKeyFn = (item: ClientFlowScreen): string => item.clientSideUid;
