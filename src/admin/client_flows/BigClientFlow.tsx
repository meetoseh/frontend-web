import { ReactElement, useContext, useEffect } from 'react';
import { ModalContext } from '../../shared/contexts/ModalContext';
import {
  WritableValueWithTypedCallbacks,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { ClientFlow, clientFlowKeyMap } from './ClientFlow';
import { adaptActiveVWCToAbortSignal } from '../../shared/lib/adaptActiveVWCToAbortSignal';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingMapper } from '../crud/CrudFetcher';
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
import { describeError } from '../../shared/forms/ErrorBlock';
import { showUserPicker } from '../users/showUserPicker';
import { showTextInputModal } from '../../shared/components/showTextInputModal';

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
  const clientFlowNRPopupErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useValueWithCallbacksEffect(clientFlowNR, (cf) => {
    setVWC(clientFlowNRPopupErrorVWC, cf.error);
    return undefined;
  });
  useErrorModal(modalContext.modals, clientFlowNRPopupErrorVWC, 'loading client flow');

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

  const saveableErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useValueWithCallbacksEffect(clientFlowSaveable.state, (s) => {
    if (s.type === 'error') {
      setVWC(saveableErrorVWC, s.error);
    } else {
      setVWC(saveableErrorVWC, null);
    }
    return undefined;
  });
  useErrorModal(modalContext.modals, saveableErrorVWC, 'saving client flow');

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

  const testErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, testErrorVWC, 'testing client flow');

  const testFlow = async (dryRun: boolean, userSub?: string) => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      setVWC(workingVWC, false);
      return;
    }

    const loginContext = loginContextUnch;
    const draft = draftVWC.get();
    try {
      const response = await apiFetch(
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

      if (!response.ok) {
        throw response;
      }

      await showYesNoModal(modalContext.modals, {
        title: 'Success',
        body: 'The flow has been triggered on your client',
        cta1: 'Okay',
        emphasize: 1,
      }).promise;
    } catch (e) {
      const err = await describeError(e);
      setVWC(testErrorVWC, err);
    } finally {
      setVWC(workingVWC, false);
    }
  };

  const cloneErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, cloneErrorVWC, 'cloning client flow');

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
        </div>
        <div className={styles.screens}>
          <div className={styles.screensTitle}>Screens</div>
          <DraggableTable
            thead={
              <thead>
                <tr>
                  <th scope="col">Name</th>
                </tr>
              </thead>
            }
            items={screensFastTWVWC}
            render={renderScreenRow}
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
                        setVWC(cloneErrorVWC, <>A flow with this slug already exists</>);
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
                      setVWC(cloneErrorVWC, await describeError(e));
                    } finally {
                      setVWC(workingVWC, false);
                    }
                  }}
                  disabled={disabled}
                  spinner={spinner}>
                  Clone Flow
                </Button>
              </>
            )}
          />
        </div>
      </div>
    </>
  );
};

const renderScreenRow = (item: ClientFlowScreen): ReactElement => {
  return (
    <>
      <td>{item.name ?? item.screen.slug}</td>
    </>
  );
};

const screenKeyFn = (item: ClientFlowScreen): string => item.clientSideUid;
