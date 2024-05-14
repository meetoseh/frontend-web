import { CSSProperties, ReactElement, useCallback, useContext, useEffect } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { Saveable } from '../../../shared/models/Saveable';
import {
  ClientFlowScreen,
  clientFlowScreenScreenVariableKeyMap,
  serializeClientFlowScreen,
  serializeClientFlowScreenScreenVariable,
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
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';
import { convertUsingMapper } from '../../crud/CrudFetcher';
import { describeError } from '../../../shared/forms/ErrorBlock';
import { useErrorModal } from '../../../shared/hooks/useErrorModal';
import { Checkbox } from '../../../shared/forms/Checkbox';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { TextInput } from '../../../shared/forms/TextInput';

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
  }, [flowScreenSaveable]);

  const onClickOutside = useCallback(async () => {
    const closed = createCancelablePromiseFromCallbacks(visible.callbacks);
    closed.promise.catch(() => {});
    if (!visible.get()) {
      closed.cancel();
      return;
    }

    const saveTargetChanged = createCancelablePromiseFromCallbacks(
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
  }, [visible, flowScreenSaveable, modalContext, saveErrorVWC]);

  return (
    <Inner
      flow={flow}
      flowScreenSaveable={flowScreenSaveable}
      visible={visible}
      onClickOutside={onClickOutside}
      onDelete={onDelete}
    />
  );
};

const Inner = ({
  flowScreenSaveable,
  flow,
  visible,
  onClickOutside,
  onDelete,
}: {
  flowScreenSaveable: Saveable<ClientFlowScreen>;
  flow: ValueWithCallbacks<{
    clientSchema: any;
    serverSchema: any;
  }>;
  visible: ValueWithCallbacks<boolean>;
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
        <Content flow={flow} flowScreenSaveable={flowScreenSaveable} onDelete={onDelete} />
      </div>
    </div>
  );
};

const Content = ({
  flow,
  flowScreenSaveable,
  onDelete,
}: {
  flow: ValueWithCallbacks<{
    clientSchema: any;
    serverSchema: any;
  }>;
  flowScreenSaveable: Saveable<ClientFlowScreen>;
  onDelete?: () => void;
}): ReactElement => {
  const modalContext = useContext(ModalContext);
  const valueVWC = useMappedValueWithCallbacks(flowScreenSaveable.state, (state) =>
    state.type === 'error' ? state.erroredValue : state.value
  );

  const fixedValueVWC = useMappedValueWithCallbacks(valueVWC, (v) => v.screen.fixed);
  const fixedCanonicalTextVWC = useMappedValueWithCallbacks(fixedValueVWC, (v) =>
    JSON.stringify(v, undefined, 2)
  );
  const fixedTextVWC = useWritableValueWithCallbacks<string>(() => fixedCanonicalTextVWC.get());
  useValueWithCallbacksEffect(fixedCanonicalTextVWC, (v) => {
    setVWC(fixedTextVWC, v);
    return undefined;
  });

  const fixedErrorVWC = useWritableValueWithCallbacks<string | null>(() => null);
  useValueWithCallbacksEffect(useDelayedValueWithCallbacks(fixedTextVWC, 1), (text) => {
    setVWC(fixedErrorVWC, null);
    if (text === fixedCanonicalTextVWC.get()) {
      return;
    }

    try {
      const parsed = JSON.parse(text);
      flowScreenSaveable.onClientChange({
        ...valueVWC.get(),
        screen: {
          ...valueVWC.get().screen,
          fixed: parsed,
        },
      });
    } catch (e) {
      console.log('error', e);
      if (
        typeof e === 'object' &&
        e !== null &&
        'message' in e &&
        typeof (e as any).message === 'string'
      ) {
        setVWC(fixedErrorVWC, (e as any).message);
      } else {
        setVWC(fixedErrorVWC, 'Unknown error while parsing');
      }
    }
    return undefined;
  });

  const fixedTextareaRef = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(() => null);
  useValuesWithCallbacksEffect([fixedCanonicalTextVWC, fixedTextareaRef], () => {
    const refRaw = fixedTextareaRef.get();
    if (refRaw === null) {
      return undefined;
    }
    const ref = refRaw;

    ref.value = fixedCanonicalTextVWC.get();

    ref.addEventListener('change', handleChange);
    return () => {
      ref.removeEventListener('change', handleChange);
    };

    function handleChange() {
      console.log('updating fixedText');
      setVWC(fixedTextVWC, ref.value);
    }
  });

  const variableValueVWC = useMappedValueWithCallbacks(valueVWC, (v) => v.screen.variable);
  const variableCanonicalTextVWC = useMappedValueWithCallbacks(variableValueVWC, (v) =>
    JSON.stringify(serializeClientFlowScreenScreenVariable(v), undefined, 2)
  );
  const variableTextVWC = useWritableValueWithCallbacks<string>(() =>
    variableCanonicalTextVWC.get()
  );
  useValueWithCallbacksEffect(variableCanonicalTextVWC, (v) => {
    setVWC(variableTextVWC, v);
    return undefined;
  });

  const variableErrorVWC = useWritableValueWithCallbacks<string | null>(() => null);
  useValueWithCallbacksEffect(useDelayedValueWithCallbacks(variableTextVWC, 1), (text) => {
    setVWC(variableErrorVWC, null);
    if (text === variableCanonicalTextVWC.get()) {
      return;
    }

    try {
      const raw = JSON.parse(text);
      const parsed = convertUsingMapper(raw, clientFlowScreenScreenVariableKeyMap);
      flowScreenSaveable.onClientChange({
        ...valueVWC.get(),
        screen: {
          ...valueVWC.get().screen,
          variable: parsed,
        },
      });
    } catch (e) {
      console.log('error', e);
      if (
        typeof e === 'object' &&
        e !== null &&
        'message' in e &&
        typeof (e as any).message === 'string'
      ) {
        setVWC(variableErrorVWC, (e as any).message);
      } else {
        setVWC(variableErrorVWC, 'Unknown error while parsing');
      }
    }
    return undefined;
  });

  const variableTextareaRef = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(() => null);
  useValuesWithCallbacksEffect([variableCanonicalTextVWC, variableTextareaRef], () => {
    const refRaw = variableTextareaRef.get();
    if (refRaw === null) {
      return undefined;
    }
    const ref = refRaw;

    ref.value = variableCanonicalTextVWC.get();

    ref.addEventListener('change', handleChange);
    return () => {
      ref.removeEventListener('change', handleChange);
    };

    function handleChange() {
      setVWC(variableTextVWC, ref.value);
    }
  });

  const testClientParametersObjectVWC = useMappedValueWithCallbacks(
    flow,
    (v) => v.clientSchema.example ?? {}
  );
  const testClientParametersCanonicalTextVWC = useMappedValueWithCallbacks(
    testClientParametersObjectVWC,
    (v) => JSON.stringify(v, undefined, 2)
  );
  const testClientParametersTextVWC = useWritableValueWithCallbacks<string>(() =>
    testClientParametersCanonicalTextVWC.get()
  );

  const testClientParametersErrorVWC = useWritableValueWithCallbacks<string | null>(() => null);
  useValueWithCallbacksEffect(
    useDelayedValueWithCallbacks(testClientParametersTextVWC, 1),
    (text) => {
      setVWC(testClientParametersErrorVWC, null);
      if (text === testClientParametersCanonicalTextVWC.get()) {
        return;
      }

      try {
        const parsed = JSON.parse(text);
        flowScreenSaveable.onClientChange({
          ...valueVWC.get(),
          screen: {
            ...valueVWC.get().screen,
            fixed: parsed,
          },
        });
      } catch (e) {
        console.log('error', e);
        if (
          typeof e === 'object' &&
          e !== null &&
          'message' in e &&
          typeof (e as any).message === 'string'
        ) {
          setVWC(testClientParametersErrorVWC, (e as any).message);
        } else {
          setVWC(testClientParametersErrorVWC, 'Unknown error while parsing');
        }
      }
      return undefined;
    }
  );

  const testClientParametersTextareaRef = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(
    () => null
  );
  useValuesWithCallbacksEffect(
    [testClientParametersCanonicalTextVWC, testClientParametersTextareaRef],
    () => {
      const refRaw = testClientParametersTextareaRef.get();
      if (refRaw === null) {
        return undefined;
      }
      const ref = refRaw;

      ref.value = testClientParametersCanonicalTextVWC.get();

      ref.addEventListener('change', handleChange);
      return () => {
        ref.removeEventListener('change', handleChange);
      };

      function handleChange() {
        setVWC(testClientParametersTextVWC, ref.value);
      }
    }
  );

  const testServerParametersObjectVWC = useMappedValueWithCallbacks(
    flow,
    (v) => v.serverSchema.example ?? {}
  );
  const testServerParametersCanonicalTextVWC = useMappedValueWithCallbacks(
    testServerParametersObjectVWC,
    (v) => JSON.stringify(v, undefined, 2)
  );
  const testServerParametersTextVWC = useWritableValueWithCallbacks<string>(() =>
    testServerParametersCanonicalTextVWC.get()
  );
  const testServerParametersErrorVWC = useWritableValueWithCallbacks<string | null>(() => null);
  useValueWithCallbacksEffect(
    useDelayedValueWithCallbacks(testServerParametersTextVWC, 1),
    (text) => {
      setVWC(testServerParametersErrorVWC, null);
      if (text === testServerParametersCanonicalTextVWC.get()) {
        return;
      }

      try {
        const parsed = JSON.parse(text);
        flowScreenSaveable.onClientChange({
          ...valueVWC.get(),
          screen: {
            ...valueVWC.get().screen,
            fixed: parsed,
          },
        });
      } catch (e) {
        console.log('error', e);
        if (
          typeof e === 'object' &&
          e !== null &&
          'message' in e &&
          typeof (e as any).message === 'string'
        ) {
          setVWC(testServerParametersErrorVWC, (e as any).message);
        } else {
          setVWC(testServerParametersErrorVWC, 'Unknown error while parsing');
        }
      }
      return undefined;
    }
  );
  const testServerParametersTextareaRef = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(
    () => null
  );
  useValuesWithCallbacksEffect(
    [testServerParametersCanonicalTextVWC, testServerParametersTextareaRef],
    () => {
      const refRaw = testServerParametersTextareaRef.get();
      if (refRaw === null) {
        return undefined;
      }
      const ref = refRaw;

      ref.value = testServerParametersCanonicalTextVWC.get();

      ref.addEventListener('change', handleChange);
      return () => {
        ref.removeEventListener('change', handleChange);
      };

      function handleChange() {
        setVWC(testServerParametersTextVWC, ref.value);
      }
    }
  );

  const testErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, testErrorVWC, 'while testing flow screen');

  const dryRunVWC = useWritableValueWithCallbacks<boolean>(() => false);

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
                    fixed: {},
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
      <CrudFormElement title="Fixed">
        <textarea className={styles.fixed} ref={(r) => setVWC(fixedTextareaRef, r)} rows={10} />
        <RenderGuardedComponent
          props={fixedErrorVWC}
          component={(error) =>
            error === null ? <></> : <div className={styles.fixedError}>{error}</div>
          }
        />
      </CrudFormElement>
      <CrudFormElement title="Variable">
        <textarea
          className={styles.variable}
          ref={(r) => setVWC(variableTextareaRef, r)}
          rows={10}
        />
        <RenderGuardedComponent
          props={variableErrorVWC}
          component={(error) =>
            error === null ? <></> : <div className={styles.variableError}>{error}</div>
          }
        />
      </CrudFormElement>
      <div className={styles.testContainer}>
        <CrudFormElement title="Test Client Parameters">
          <textarea
            className={styles.testParameters}
            ref={(r) => setVWC(testClientParametersTextareaRef, r)}
            rows={10}
          />
          <RenderGuardedComponent
            props={testClientParametersErrorVWC}
            component={(error) =>
              error === null ? <></> : <div className={styles.testParametersError}>{error}</div>
            }
          />
        </CrudFormElement>
        <CrudFormElement title="Test Server Parameters">
          <textarea
            className={styles.testParameters}
            ref={(r) => setVWC(testServerParametersTextareaRef, r)}
            rows={10}
          />
          <RenderGuardedComponent
            props={testServerParametersErrorVWC}
            component={(error) =>
              error === null ? <></> : <div className={styles.testParametersError}>{error}</div>
            }
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
                const clientParameters = JSON.parse(testClientParametersTextVWC.get());
                const serverParameters = JSON.parse(testServerParametersTextVWC.get());

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
