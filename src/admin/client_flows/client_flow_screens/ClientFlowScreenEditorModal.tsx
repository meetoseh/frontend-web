import { CSSProperties, Fragment, ReactElement, useCallback, useContext, useEffect } from 'react';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { Saveable } from '../../../shared/models/Saveable';
import {
  ClientFlowScreen,
  ClientFlowScreenFlag,
  ClientFlowScreenVariableInput,
  serializeClientFlowScreen,
} from './ClientFlowScreen';
import { useDelayedValueWithCallbacks } from '../../../shared/hooks/useDelayedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../../shared/lib/setVWC';
import { createCancelablePromiseFromCallbacks } from '../../../shared/lib/createCancelablePromiseFromCallbacks';
import { showYesNoModal } from '../../../shared/lib/showYesNoModal';
import { ModalContext } from '../../../shared/contexts/ModalContext';
import { useDynamicAnimationEngine } from '../../../shared/anim/useDynamicAnimation';
import { ease } from '../../../shared/lib/Bezier';
import styles from './ClientFlowScreenEditorModal.module.css';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useStyleVWC } from '../../../shared/hooks/useStyleVWC';
import { CrudFormElement } from '../../crud/CrudFormElement';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { Button } from '../../../shared/forms/Button';
import { showClientScreenPicker } from '../../client_screens/showClientScreenPicker';
import { convertUsingMapper } from '../../crud/CrudFetcher';
import { ErrorBlock, describeError } from '../../../shared/forms/ErrorBlock';
import { useErrorModal } from '../../../shared/hooks/useErrorModal';
import { Checkbox } from '../../../shared/forms/Checkbox';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { TextInput } from '../../../shared/forms/TextInput';
import { RawJSONEditor } from '../../lib/schema/RawJSONEditor';
import { NetworkResponse, useNetworkResponse } from '../../../shared/hooks/useNetworkResponse';
import { ClientScreen, clientScreenKeyMap } from '../../client_screens/ClientScreen';
import { adaptActiveVWCToAbortSignal } from '../../../shared/lib/adaptActiveVWCToAbortSignal';
import { prettySchemaPath } from '../../lib/schema/prettySchemaPath';
import { ClientScreenSchema } from './schema/multiple/ClientScreenSchema';
import { useOsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { VerticalSpacer } from '../../../shared/components/VerticalSpacer';

export type ClientFlowScreenEditorModalProps = {
  /** The flow this screen is within, so that we can perform tests */
  flow: ValueWithCallbacks<{
    clientSchema: any;
    serverSchema: any;
  }>;

  /** The flow screen which is being edited. */
  flowScreenSaveable: Saveable<ClientFlowScreen>;
  /**
   * If specified a delete button is shown and this is called when the delete
   * button is clicked.
   */
  onDelete?: () => void;
  /**
   * Called after the modal has been dismissed and all animations
   * have been played, so the modal can be removed from the DOM
   */
  onDismiss: () => void;
  /**
   * We set this to a function that will begin playing the close
   * animation, then call `onDismiss` once the animation finishes.
   * Idempotent.
   */
  requestDismiss: WritableValueWithCallbacks<() => void>;
};

/**
 * A modal where the user can edit a client flow screen. This will animate
 * when opening and closing, and will call `onDismiss` when the close animation
 * finishes.
 *
 * You can call `requestDismiss` to begin the close animation early.
 */
export const ClientFlowScreenEditorModal = ({
  flow,
  flowScreenSaveable,
  onDelete,
  onDismiss,
  requestDismiss,
}: ClientFlowScreenEditorModalProps) => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const visible = useWritableValueWithCallbacks<boolean>(() => true);

  const saveErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, saveErrorVWC, 'while saving flow screen');

  useEffect(() => {
    setVWC(requestDismiss, () => {
      setVWC(visible, false);
    });
  }, [requestDismiss, visible]);

  useValueWithCallbacksEffect(useDelayedValueWithCallbacks(visible, 350), (visible) => {
    if (!visible) {
      onDismiss();
    }
    return undefined;
  });

  const valueVWC = useMappedValueWithCallbacks(flowScreenSaveable.state, (state) =>
    state.type === 'error' ? state.erroredValue : state.value
  );
  const slugVWC = useMappedValueWithCallbacks(valueVWC, (v) => v.screen.slug);

  const screenNR = useNetworkResponse<ClientScreen>(
    (active, loginContext) =>
      adaptActiveVWCToAbortSignal(active, async (signal): Promise<ClientScreen> => {
        const response = await apiFetch(
          '/api/1/client_screens/search',
          {
            method: 'POST',
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
            }),
            signal,
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
        const raw = await response.json();
        if (raw.items.length !== 1) {
          throw new Error('expected exactly one client screen');
        }
        return convertUsingMapper(raw.items[0], clientScreenKeyMap);
      }),
    {
      dependsOn: [slugVWC],
    }
  );

  const validate = useCallback(async () => {
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      throw new Error('not logged in');
    }
    const loginContext = loginContextUnch;

    const flowInfo = flow.get();
    const flowScreen = valueVWC.get();
    const clientParameters = flowInfo.clientSchema.example ?? {};
    const serverParameters = flowInfo.serverSchema.example ?? {};

    const response = await apiFetch(
      '/api/1/client_flows/test_screen',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          flow: {
            client_schema: flowInfo.clientSchema,
            server_schema: flowInfo.serverSchema,
          },
          flow_screen: serializeClientFlowScreen(flowScreen),
          client_parameters: clientParameters,
          server_parameters: serverParameters,
          dry_run: true,
        }),
      },
      loginContext
    );
    if (!response.ok) {
      throw response;
    }
  }, [flow, loginContextRaw.value, valueVWC]);

  const onClickOutside = useCallback(async () => {
    const closed = createCancelablePromiseFromCallbacks(visible.callbacks);
    closed.promise.catch(() => {});
    if (!visible.get()) {
      closed.cancel();
      return;
    }

    let saveTargetChanged = createCancelablePromiseFromCallbacks(
      flowScreenSaveable.state.callbacks
    );
    saveTargetChanged.promise.catch(() => {});

    const initialStateType = flowScreenSaveable.state.get().type;
    if (initialStateType === 'ready') {
      closed.cancel();
      saveTargetChanged.cancel();
      setVWC(visible, false);
      return;
    }

    // check for missing triggers in the allowed triggers list
    const screenInfo = screenNR.get();
    if (screenInfo.type === 'success') {
      const screen = screenInfo.result;
      const value = valueVWC.get();
      const allowedTriggers = new Set(value.allowedTriggers);
      const extraneousTriggers = new Set<string>(value.allowedTriggers);
      const missingTriggers = new Set<string>();

      const recurse = (schema: any, value: any) => {
        if (value === null || value === undefined) {
          return;
        }

        if ('x-enum-discriminator' in schema) {
          const discriminatorKey = schema['x-enum-discriminator'] as string;
          const discriminatorValue = value[discriminatorKey];

          const oneOf = schema.oneOf as { type: 'object'; properties: any }[];
          for (const oneOfSchema of oneOf) {
            if (oneOfSchema.properties[discriminatorKey].enum[0] === discriminatorValue) {
              recurse(oneOfSchema, value);
              return;
            }
          }
          return;
        }

        if (schema.type === 'object') {
          for (const key in schema.properties) {
            recurse(schema.properties[key], value[key]);
          }
          return;
        }

        if (schema.type === 'array') {
          for (const item of value) {
            recurse(schema.items, item);
          }
          return;
        }

        if (
          schema.type === 'string' &&
          schema.format === 'flow_slug' &&
          typeof value === 'string'
        ) {
          if (!allowedTriggers.has(value)) {
            missingTriggers.add(value);
          }
          extraneousTriggers.delete(value);
          return;
        }
      };

      recurse(screen.screenSchema, value.screen.fixed);

      if (missingTriggers.size > 0) {
        const confirmation = showYesNoModal(modalContext.modals, {
          title: 'Missing Triggers',
          body: `The following triggers are missing from the allowed triggers list: ${Array.from(
            missingTriggers
          ).join(', ')}. Would you like to add them?`,
          cta1: 'Add',
          cta2: 'Discard Pending Changes',
          emphasize: 1,
        });

        await Promise.race([closed.promise, saveTargetChanged.promise, confirmation.promise]);
        if (closed.done()) {
          saveTargetChanged.cancel();
          confirmation.cancel();
          return;
        }
        if (saveTargetChanged.done()) {
          closed.cancel();
          confirmation.cancel();
          return;
        }
        const userAnswer = await confirmation.promise;
        if (!userAnswer) {
          closed.cancel();
          saveTargetChanged.cancel();
          if (userAnswer === false) {
            setVWC(visible, false);
          }
          return;
        }

        saveTargetChanged.cancel();
        const newTriggers = Array.from(allowedTriggers).concat(Array.from(missingTriggers));
        flowScreenSaveable.onClientChange({
          ...value,
          allowedTriggers: newTriggers,
        });
        saveTargetChanged = createCancelablePromiseFromCallbacks(
          flowScreenSaveable.state.callbacks
        );
      }

      if (extraneousTriggers.size > 0) {
        const confirmation = showYesNoModal(modalContext.modals, {
          title: 'Extraneous Triggers',
          body: `The following triggers are in the allowed list but don't seem to appear in the screen: ${Array.from(
            extraneousTriggers
          ).join(', ')}. Would you like to remove them?`,
          cta1: 'Remove',
          cta2: 'Keep',
          emphasize: 1,
        });
        await Promise.race([closed.promise, saveTargetChanged.promise, confirmation.promise]);
        if (closed.done()) {
          saveTargetChanged.cancel();
          confirmation.cancel();
          return;
        }
        if (saveTargetChanged.done()) {
          closed.cancel();
          confirmation.cancel();
          return;
        }
        const userAnswer = await confirmation.promise;
        if (!userAnswer) {
          closed.cancel();
          saveTargetChanged.cancel();
          if (userAnswer === false) {
            setVWC(visible, false);
          }
          return;
        }

        saveTargetChanged.cancel();
        const newTriggers = valueVWC
          .get()
          .allowedTriggers.filter((trigger) => !extraneousTriggers.has(trigger));
        flowScreenSaveable.onClientChange({
          ...valueVWC.get(),
          allowedTriggers: newTriggers,
        });
        saveTargetChanged = createCancelablePromiseFromCallbacks(
          flowScreenSaveable.state.callbacks
        );
      }
    }

    const confirmation = showYesNoModal(modalContext.modals, {
      title: initialStateType === 'draft' ? 'Save changes?' : 'Retry saving?',
      body: 'You have unsaved changes. Would you like to save them?',
      cta1: 'Save',
      cta2: 'Discard',
      emphasize: 1,
    });
    await Promise.race([closed.promise, saveTargetChanged.promise, confirmation.promise]);

    if (closed.done()) {
      saveTargetChanged.cancel();
      confirmation.cancel();
      return;
    }

    if (saveTargetChanged.done()) {
      closed.cancel();
      confirmation.cancel();
      return;
    }

    const userAnswer = await confirmation.promise;
    if (!userAnswer) {
      closed.cancel();
      saveTargetChanged.cancel();
      if (userAnswer === false) {
        setVWC(visible, false);
      }
      return;
    }

    saveTargetChanged.cancel();

    try {
      const validatePromise = validate();
      await Promise.race([closed.promise, validatePromise]);
    } catch (e) {
      console.log('error from validatePromise', e);
      const err = await describeError(e);
      if (closed.done()) {
        return;
      }
      setVWC(saveErrorVWC, err);
      return;
    }

    try {
      const savePromise = flowScreenSaveable.requestImmediateSave();
      await Promise.race([closed.promise, savePromise]);
      setVWC(saveErrorVWC, null);
      setVWC(visible, false);
    } catch (e) {
      console.log('error from savePromise', e);
      const err = await describeError(e);
      if (closed.done()) {
        return;
      }
      setVWC(saveErrorVWC, err);
    } finally {
      closed.cancel();
    }
  }, [visible, flowScreenSaveable, modalContext, saveErrorVWC, validate, screenNR, valueVWC]);

  return (
    <Inner
      flow={flow}
      flowScreenSaveable={flowScreenSaveable}
      visible={visible}
      screenNR={screenNR}
      onClickOutside={onClickOutside}
      onDelete={onDelete}
    />
  );
};

const Inner = ({
  flowScreenSaveable,
  flow,
  visible,
  screenNR,
  onClickOutside,
  onDelete,
}: {
  flowScreenSaveable: Saveable<ClientFlowScreen>;
  flow: ValueWithCallbacks<{
    clientSchema: any;
    serverSchema: any;
  }>;
  visible: ValueWithCallbacks<boolean>;
  screenNR: ValueWithCallbacks<NetworkResponse<ClientScreen>>;
  onClickOutside: () => void;
  onDelete?: () => void;
}): ReactElement => {
  const backgroundOpacityVWC = useWritableValueWithCallbacks(() => 0);
  const foregroundStateVWC = useWritableValueWithCallbacks(() => ({
    opacity: 1,
    progress: 0,
  }));

  const engine = useDynamicAnimationEngine();
  const playEntrance = useCallback(() => {
    const backgroundOpacityStart = backgroundOpacityVWC.get();
    const foregroundStartProgress = foregroundStateVWC.get().progress;
    engine.play([
      {
        id: 'darken-background',
        duration: 350,
        progressEase: { type: 'bezier', bezier: ease },
        onFrame: (progress) => {
          setVWC(
            backgroundOpacityVWC,
            backgroundOpacityStart + (0.54 - backgroundOpacityStart) * progress
          );
        },
      },
      {
        id: 'wipe-foreground',
        duration: 350,
        progressEase: { type: 'bezier', bezier: ease },
        onFrame: (progress) => {
          setVWC(foregroundStateVWC, {
            opacity: 1,
            progress: foregroundStartProgress + (1 - foregroundStartProgress) * progress,
          });
        },
      },
    ]);
  }, [engine, backgroundOpacityVWC, foregroundStateVWC]);
  const playExit = useCallback(() => {
    const backgroundOpacityStart = backgroundOpacityVWC.get();
    const foregroundStart = { ...foregroundStateVWC.get() };
    engine.play([
      {
        id: 'lighten-background',
        duration: 350,
        progressEase: { type: 'bezier', bezier: ease },
        onFrame: (progress) => {
          setVWC(
            backgroundOpacityVWC,
            backgroundOpacityStart + (0 - backgroundOpacityStart) * progress
          );
        },
      },
      {
        id: 'fade-out-foreground',
        duration: 350,
        progressEase: { type: 'bezier', bezier: ease },
        onFrame: (progress) => {
          setVWC(foregroundStateVWC, {
            opacity: foregroundStart.opacity + (0 - foregroundStart.opacity) * progress,
            progress: foregroundStart.progress,
            // opacity: foregroundStart.opacity,
            // progress: foregroundStart.progress + (0 - foregroundStart.progress) * progress,
          });
        },
      },
    ]);
  }, [engine, backgroundOpacityVWC, foregroundStateVWC]);

  useEffect(() => {
    playEntrance();
  }, [playEntrance]);

  useValueWithCallbacksEffect(visible, (visible) => {
    if (!visible) {
      playExit();
    }
    return undefined;
  });

  const containerRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const containerStyleVWC = useMappedValueWithCallbacks(
    backgroundOpacityVWC,
    (opacity): CSSProperties => ({
      background: `rgba(0, 0, 0, ${opacity})`,
    })
  );
  useStyleVWC(containerRef, containerStyleVWC);

  const contentRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const contentStyleVWC = useMappedValueWithCallbacks(
    foregroundStateVWC,
    (state): CSSProperties => {
      if (state.progress === 0) {
        return { maskImage: 'none', opacity: 0 };
      }

      if (state.progress === 1) {
        return { maskImage: 'none', opacity: state.opacity };
      }

      const opacity = state.opacity;
      if (opacity === 0) {
        return { maskImage: 'none', opacity: 0 };
      }

      const shadeSize = 0.1;
      const rescaledProgress = state.progress / (1 - shadeSize);

      return {
        maskImage: `linear-gradient(to bottom, rgba(0, 0, 0, ${opacity}) 0%, rgba(0, 0, 0, ${opacity}) ${
          (rescaledProgress - shadeSize) * 100
        }%, rgba(0, 0, 0, 0) ${rescaledProgress * 100}%)`,
        opacity: 1,
      };
    }
  );
  useStyleVWC(contentRef, contentStyleVWC);

  return (
    <div
      className={styles.container}
      style={containerStyleVWC.get()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClickOutside();
      }}
      ref={(r) => setVWC(containerRef, r)}>
      <div
        className={styles.content}
        style={contentStyleVWC.get()}
        onClick={(e) => {
          e.stopPropagation();
        }}
        ref={(r) => setVWC(contentRef, r)}>
        <Content
          flow={flow}
          flowScreenSaveable={flowScreenSaveable}
          onDelete={onDelete}
          screenNR={screenNR}
        />
      </div>
    </div>
  );
};

const Content = ({
  flow,
  flowScreenSaveable,
  screenNR,
  onDelete,
}: {
  flow: ValueWithCallbacks<{
    clientSchema: any;
    serverSchema: any;
  }>;
  flowScreenSaveable: Saveable<ClientFlowScreen>;
  screenNR: ValueWithCallbacks<NetworkResponse<ClientScreen>>;
  onDelete?: () => void;
}): ReactElement => {
  const modalContext = useContext(ModalContext);
  const valueVWC = useMappedValueWithCallbacks(flowScreenSaveable.state, (state) =>
    state.type === 'error' ? state.erroredValue : state.value
  );

  const fixedValueVWC = useMappedValueWithCallbacks(valueVWC, (v) => v.screen.fixed);
  const variableValueVWC = useMappedValueWithCallbacks(valueVWC, (v) => v.screen.variable);
  const allowedTriggersValueVWC = useMappedValueWithCallbacks(valueVWC, (v) => v.allowedTriggers);
  const mappedVariableValueVWC = useMappedValueWithCallbacks(variableValueVWC, (v) => {
    const result = new Map<string, ClientFlowScreenVariableInput>();
    for (const variableInput of v) {
      result.set(prettySchemaPath(variableInput.outputPath), variableInput);
    }
    return result;
  });
  const testClientParametersObjectVWC = useWritableValueWithCallbacks(
    () => flow.get().clientSchema.example ?? {}
  );
  const testServerParametersObjectVWC = useWritableValueWithCallbacks(
    () => flow.get().serverSchema.example ?? {}
  );
  const flagsVWC = useMappedValueWithCallbacks(valueVWC, (v) => v.flags);

  const testErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, testErrorVWC, 'while testing flow screen');

  const dryRunVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const imageHandler = useOsehImageStateRequestHandler({});

  const loginContextRaw = useContext(LoginContext);

  return (
    <div className={styles.flowScreen}>
      <div className={styles.name}>
        <RenderGuardedComponent
          props={useMappedValueWithCallbacks(valueVWC, (v) => v.name ?? '')}
          component={(name) => (
            <TextInput
              type="text"
              label="Name"
              value={name}
              onChange={(v) => flowScreenSaveable.onClientChange({ ...valueVWC.get(), name: v })}
              html5Validation={null}
              disabled={false}
              help="Used only in the admin area"
              inputStyle="normal"
            />
          )}
          applyInstantly
        />
      </div>
      <CrudFormElement title="Screen">
        <RenderGuardedComponent
          props={useMappedValueWithCallbacks(valueVWC, (v) => v.screen.slug)}
          component={(slug) => <div className={styles.slug}>{slug}</div>}
        />
        <div className={styles.buttons}>
          <Button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              const choice = await showClientScreenPicker({ modals: modalContext.modals }).promise;
              if (choice !== null) {
                flowScreenSaveable.onClientChange({
                  ...valueVWC.get(),
                  screen: {
                    slug: choice.slug,
                    fixed: (choice.screenSchema as any).example ?? {},
                    variable: [],
                  },
                });
              }
            }}>
            Choose Different Screen
          </Button>
          {onDelete === undefined ? (
            <></>
          ) : (
            <Button
              type="button"
              variant="outlined-danger"
              onClick={async (e) => {
                e.preventDefault();

                const confirmation = await showYesNoModal(modalContext.modals, {
                  title: 'Remove Screen?',
                  body: 'Are you sure you want to remove this screen from this flow?',
                  cta1: 'Remove',
                  cta2: 'Cancel',
                  emphasize: 2,
                }).promise;
                if (confirmation) {
                  onDelete();
                }
              }}>
              Remove Screen From Flow
            </Button>
          )}
        </div>
      </CrudFormElement>
      <VerticalSpacer height={32} />
      <RenderGuardedComponent
        props={screenNR}
        component={(screen) =>
          screen.type === 'error' ? (
            <ErrorBlock>{screen.error}</ErrorBlock>
          ) : screen.type !== 'success' ? (
            <></>
          ) : (
            <ClientScreenSchema
              schema={screen.result.screenSchema}
              value={{
                get: () => fixedValueVWC.get(),
                set: (v) =>
                  flowScreenSaveable.onClientChange({
                    ...valueVWC.get(),
                    screen: { ...valueVWC.get().screen, fixed: v },
                  }),
                callbacks: fixedValueVWC.callbacks,
              }}
              variable={{
                get: () => mappedVariableValueVWC.get(),
                set: (v) =>
                  flowScreenSaveable.onClientChange({
                    ...valueVWC.get(),
                    screen: { ...valueVWC.get().screen, variable: Array.from(v.values()) },
                  }),
                callbacks: mappedVariableValueVWC.callbacks,
              }}
              imageHandler={imageHandler}
              noCopy
            />
          )
        }
      />
      <VerticalSpacer height={24} />
      <ClientScreenSchema
        schema={{
          type: 'array',
          title: 'Allowed Triggers',
          items: {
            type: 'string',
            format: 'flow_slug',
            description: 'The slug of the client flow that may be triggered',
            example: 'skip',
          },
        }}
        value={{
          get: () => allowedTriggersValueVWC.get(),
          set: (v) =>
            flowScreenSaveable.onClientChange({
              ...valueVWC.get(),
              allowedTriggers: v,
            }),
          callbacks: allowedTriggersValueVWC.callbacks,
        }}
        variable={{
          get: () => new Map(),
          set: (v) => {},
          callbacks: new Callbacks(),
        }}
        noCopy
        imageHandler={imageHandler}
      />
      <VerticalSpacer height={40} />
      <CrudFormElement title="Flags">
        <VerticalSpacer height={8} />
        {(
          [
            [ClientFlowScreenFlag.SHOWS_ON_IOS, 'Shows on iOS'],
            [ClientFlowScreenFlag.SHOWS_ON_ANDROID, 'Shows on Android'],
            [ClientFlowScreenFlag.SHOWS_ON_WEB, 'Shows on Web'],
          ] as const
        ).map(([flag, label], idx) => (
          <Fragment key={flag}>
            {idx !== 0 && <VerticalSpacer height={4} />}
            <BitCheckbox
              label={label}
              flag={flag}
              source={{
                get: () => flagsVWC.get(),
                set: (v) => flowScreenSaveable.onClientChange({ ...valueVWC.get(), flags: v }),
                callbacks: flagsVWC.callbacks,
              }}
            />
          </Fragment>
        ))}
      </CrudFormElement>
      <VerticalSpacer height={400} />
      <CrudFormElement title="Fixed">
        <RawJSONEditor
          canonicalVWC={fixedValueVWC}
          setValue={(v) =>
            flowScreenSaveable.onClientChange({
              ...valueVWC.get(),
              screen: { ...valueVWC.get().screen, fixed: v },
            })
          }
        />
      </CrudFormElement>
      <CrudFormElement title="Variable">
        <RawJSONEditor
          canonicalVWC={variableValueVWC}
          setValue={(v) =>
            flowScreenSaveable.onClientChange({
              ...valueVWC.get(),
              screen: { ...valueVWC.get().screen, variable: v },
            })
          }
        />
      </CrudFormElement>
      <CrudFormElement title="Allowed Triggers">
        <RawJSONEditor
          canonicalVWC={allowedTriggersValueVWC}
          setValue={(v) =>
            flowScreenSaveable.onClientChange({
              ...valueVWC.get(),
              allowedTriggers: v,
            })
          }
        />
      </CrudFormElement>
      <div className={styles.testContainer}>
        <CrudFormElement title="Test Client Parameters">
          <RawJSONEditor
            canonicalVWC={testClientParametersObjectVWC}
            setValue={(v) => setVWC(testClientParametersObjectVWC, v)}
          />
        </CrudFormElement>
        <CrudFormElement title="Test Server Parameters">
          <RawJSONEditor
            canonicalVWC={testServerParametersObjectVWC}
            setValue={(v) => setVWC(testServerParametersObjectVWC, v)}
          />
        </CrudFormElement>
        <CrudFormElement title="Dry Run?">
          <RenderGuardedComponent
            props={dryRunVWC}
            component={(dryRun) => (
              <Checkbox value={dryRun} setValue={(v) => setVWC(dryRunVWC, v)} label="Dry Run" />
            )}
            applyInstantly
          />
        </CrudFormElement>
        <div className={styles.testWrapper}>
          <Button
            type="button"
            onClick={async (e) => {
              const loginContextUnch = loginContextRaw.value.get();
              if (loginContextUnch.state !== 'logged-in') {
                return;
              }
              const loginContext = loginContextUnch;
              try {
                const clientParameters = testClientParametersObjectVWC.get();
                const serverParameters = testServerParametersObjectVWC.get();

                const flowInfo = flow.get();
                const flowScreen = valueVWC.get();
                const dryRun = dryRunVWC.get();

                const response = await apiFetch(
                  '/api/1/client_flows/test_screen',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json; charset=utf-8',
                    },
                    body: JSON.stringify({
                      flow: {
                        client_schema: flowInfo.clientSchema,
                        server_schema: flowInfo.serverSchema,
                      },
                      flow_screen: serializeClientFlowScreen(flowScreen),
                      client_parameters: clientParameters,
                      server_parameters: serverParameters,
                      dry_run: dryRun,
                    }),
                  },
                  loginContext
                );

                if (!response.ok) {
                  throw response;
                }

                await showYesNoModal(modalContext.modals, {
                  title: 'Success',
                  body: dryRun
                    ? 'Dry run succeeded'
                    : 'The screen is now in the front of your queue',
                  cta1: 'Okay',
                  emphasize: 1,
                }).promise;
              } catch (e) {
                const err = await describeError(e);
                setVWC(testErrorVWC, err);
              }
            }}>
            Send Test
          </Button>
        </div>
      </div>
    </div>
  );
};

const BitCheckbox = ({
  label,
  flag,
  source,
}: {
  label: string;
  flag: number;
  source: WritableValueWithCallbacks<number>;
}): ReactElement => {
  return (
    <RenderGuardedComponent
      props={useMappedValueWithCallbacks(source, (v) => (v & flag) === flag, {
        inputEqualityFn: () => false,
      })}
      component={(checked) => (
        <Checkbox
          label={label}
          value={checked}
          setValue={(v) => {
            setVWC(source, v ? source.get() | flag : source.get() & ~flag);
          }}
        />
      )}
    />
  );
};
