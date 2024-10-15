import { ReactElement, useCallback, useContext, useEffect, useMemo } from 'react';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../shared/lib/Callbacks';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { NetworkResponse, useNetworkResponse } from '../../shared/hooks/useNetworkResponse';
import { TouchPointWithMessages, touchPointWithMessagesKeyMap } from './TouchPoint';
import { adaptActiveVWCToAbortSignal } from '../../shared/lib/adaptActiveVWCToAbortSignal';
import { apiFetch } from '../../shared/ApiConstants';
import { convertUsingMapper } from '../crud/CrudFetcher';
import styles from './BigTouchPoint.module.css';
import { ModalContext } from '../../shared/contexts/ModalContext';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { setVWC } from '../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import { CrudItemBlock } from '../crud/CrudItemBlock';
import {
  TouchPointMessagesSection,
  TouchPointMessagesSectionProps,
} from './TouchPointMessagesSection';
import { useValuesWithCallbacksEffect } from '../../shared/hooks/useValuesWithCallbacksEffect';
import { TextInput } from '../../shared/forms/TextInput';
import { TouchPointSelectionStrategySelect } from './components/TouchPointSelectionStrategySelect';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { Button } from '../../shared/forms/Button';
import { showYesNoModal } from '../../shared/lib/showYesNoModal';
import { RawJSONEditor } from '../lib/schema/RawJSONEditor';
import { VerticalSpacer } from '../../shared/components/VerticalSpacer';
import { useOsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { chooseErrorFromStatus, DisplayableError } from '../../shared/lib/errors';

export const BigTouchPoint = (): ReactElement => {
  const modalContext = useContext(ModalContext);
  const eventSlugVWC = useWritableValueWithCallbacks(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('slug');
  });
  const touchPointNR = useNetworkResponse<TouchPointWithMessages>(
    (active, ctx) =>
      adaptActiveVWCToAbortSignal(
        active,
        async (signal): Promise<TouchPointWithMessages | null> => {
          const response = await apiFetch(
            '/api/1/touch_points/search',
            {
              method: 'POST',
              signal,
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                filters: {
                  event_slug: {
                    operator: 'eq',
                    value: eventSlugVWC.get(),
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

          return convertUsingMapper(data.items[0], touchPointWithMessagesKeyMap);
        }
      ),
    {
      dependsOn: [eventSlugVWC],
    }
  );

  const touchPointNRPopupErrorVWC = useWritableValueWithCallbacks<DisplayableError | null>(
    () => null
  );
  useValueWithCallbacksEffect(touchPointNR, (tp) => {
    setVWC(touchPointNRPopupErrorVWC, tp.error);
    return undefined;
  });
  useErrorModal(modalContext.modals, touchPointNRPopupErrorVWC);

  return (
    <div className={styles.container}>
      <div className={styles.title}>Touch Point</div>
      <RenderGuardedComponent
        props={touchPointNR}
        component={(tp) => {
          if (tp.type === 'unavailable') {
            return <div className={styles.error}>No touch point found</div>;
          }
          if (tp.type === 'error') {
            return <div className={styles.error}>There was an error loading the touch point</div>;
          }
          if (tp.type === 'loading') {
            return <div className={styles.error}>Loading...</div>;
          }
          if (tp.type === 'load-prevented') {
            return <div className={styles.error}>Load prevented</div>;
          }
          return <Content touchPoint={tp.result} networkResponse={touchPointNR} />;
        }}
      />
    </div>
  );
};

const Content = ({
  touchPoint,
  networkResponse,
}: {
  touchPoint: TouchPointWithMessages;
  networkResponse: ValueWithCallbacks<NetworkResponse<TouchPointWithMessages>>;
}): ReactElement => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const imageHandler = useOsehImageStateRequestHandler({});
  const savingVWC = useWritableValueWithCallbacks(() => false);
  const errorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  const sms = useWritableValueWithCallbacks(
    () => touchPoint.messages.sms
  ) as TouchPointMessagesSectionProps['messages']['sms'];
  const push = useWritableValueWithCallbacks(
    () => touchPoint.messages.push
  ) as TouchPointMessagesSectionProps['messages']['push'];
  const email = useWritableValueWithCallbacks(
    () => touchPoint.messages.email
  ) as TouchPointMessagesSectionProps['messages']['email'];
  const messages = useMemo(() => ({ sms, push, email }), [sms, push, email]);

  const slugVWC = useWritableValueWithCallbacks(() => touchPoint.eventSlug);
  useValueWithCallbacksEffect(networkResponse, (nr) => {
    setVWC(slugVWC, nr.result?.eventSlug ?? '');
    return undefined;
  });

  const selectionStrategyVWC = useWritableValueWithCallbacks(() => touchPoint.selectionStrategy);
  useValueWithCallbacksEffect(networkResponse, (nr) => {
    setVWC(selectionStrategyVWC, nr.result?.selectionStrategy ?? 'fixed');
    return undefined;
  });

  const eventSchemaVWC = useWritableValueWithCallbacks(() => touchPoint.eventSchema);
  useValueWithCallbacksEffect(networkResponse, (nr) => {
    setVWC(
      eventSchemaVWC,
      nr.result?.eventSchema ?? {
        type: 'object',
        example: {},
        additionalProperties: false,
      }
    );
    return undefined;
  });

  const saveRequiredVWC = useWritableValueWithCallbacks(() => false);
  const doSave = useCallback(async (): Promise<void> => {
    if (savingVWC.get()) {
      return;
    }
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }
    const loginContext = loginContextUnch;

    setVWC(savingVWC, true);
    setVWC(errorVWC, null);
    const old = touchPoint;
    const newSlug = slugVWC.get();
    const newSchema = eventSchemaVWC.get();
    try {
      let response;
      try {
        response = await apiFetch(
          '/api/1/touch_points/',
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              uid: old.uid,
              precondition: {
                event_slug: old.eventSlug,
                event_schema: old.eventSchema,
                selection_strategy: old.selectionStrategy,
                messages_etag: old.messagesEtag,
              },
              patch: {
                event_slug: newSlug,
                event_schema: newSchema,
                selection_strategy: selectionStrategyVWC.get(),
                messages: {
                  sms: sms.get().map((m) => ({
                    priority: m.priority,
                    uid: m.uid,
                    body_format: m.bodyFormat,
                    body_parameters: m.bodyParameters,
                  })),
                  push: push.get().map((m) => ({
                    priority: m.priority,
                    uid: m.uid,
                    title_format: m.titleFormat,
                    title_parameters: m.titleParameters,
                    body_format: m.bodyFormat,
                    body_parameters: m.bodyParameters,
                    channel_id: m.channelId,
                  })),
                  email: email.get().map((m) => ({
                    priority: m.priority,
                    uid: m.uid,
                    subject_format: m.subjectFormat,
                    subject_parameters: m.subjectParameters,
                    template: m.template,
                    template_parameters_fixed: m.templateParametersFixed,
                    template_parameters_substituted: m.templateParametersSubstituted,
                  })),
                },
              },
            }),
          },
          loginContext
        );
      } catch {
        throw new DisplayableError('connectivity', 'save touch point');
      }
      if (!response.ok) {
        throw chooseErrorFromStatus(response.status, 'save touch point');
      }
      const updatedRaw: any = await response.json();
      const updated = convertUsingMapper(updatedRaw, touchPointWithMessagesKeyMap);
      networkResponse.get().replace?.(updated);

      if (old.eventSlug !== newSlug) {
        window.history.replaceState(
          null,
          '',
          '/admin/touch_point?slug=' + encodeURIComponent(newSlug)
        );
      }

      setVWC(saveRequiredVWC, false);
    } catch (e) {
      const err =
        e instanceof DisplayableError
          ? e
          : new DisplayableError('client', 'save touch point', `${e}`);
      setVWC(errorVWC, err);
    } finally {
      setVWC(savingVWC, false);
    }
  }, [
    touchPoint,
    networkResponse,
    savingVWC,
    loginContextRaw,
    errorVWC,
    sms,
    push,
    email,
    slugVWC,
    selectionStrategyVWC,
    saveRequiredVWC,
    eventSchemaVWC,
  ]);

  useEffect(() => {
    const setRequired = () => setVWC(saveRequiredVWC, true);
    sms.callbacks.add(setRequired);
    push.callbacks.add(setRequired);
    email.callbacks.add(setRequired);
    slugVWC.callbacks.add(setRequired);
    selectionStrategyVWC.callbacks.add(setRequired);
    return () => {
      sms.callbacks.remove(setRequired);
      push.callbacks.remove(setRequired);
      email.callbacks.remove(setRequired);
      slugVWC.callbacks.remove(setRequired);
      selectionStrategyVWC.callbacks.remove(setRequired);
    };
  }, [sms, push, email, slugVWC, selectionStrategyVWC, saveRequiredVWC]);

  const saveRef = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  useValuesWithCallbacksEffect([saveRequiredVWC, savingVWC, saveRef], () => {
    const ele = saveRef.get();
    if (ele === null) {
      return;
    }
    if (savingVWC.get()) {
      ele.classList.add(styles.saving);
      return () => {
        ele.classList.remove(styles.saving);
      };
    }
    if (saveRequiredVWC.get()) {
      ele.classList.add(styles.required);
      return () => {
        ele.classList.remove(styles.required);
      };
    }
    return undefined;
  });

  const saveButtonState = useMappedValuesWithCallbacks([savingVWC, saveRequiredVWC], () => ({
    disabled: savingVWC.get() || !saveRequiredVWC.get(),
    spinner: savingVWC.get(),
  }));

  useErrorModal(modalContext.modals, errorVWC);

  const deleteErrorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);
  useErrorModal(modalContext.modals, deleteErrorVWC);

  return (
    <div className={styles.content}>
      <div className={styles.topRow}>
        <div className={styles.basic}>
          <CrudItemBlock title={touchPoint.eventSlug} controls={null}>
            <div className={styles.basicInner}>
              <RenderGuardedComponent
                props={slugVWC}
                component={(slug) => (
                  <TextInput
                    label="Event Slug"
                    value={slug}
                    onChange={(v) => {
                      setVWC(slugVWC, v);
                    }}
                    disabled={false}
                    help={null}
                    inputStyle="normal"
                    html5Validation={null}
                  />
                )}
                applyInstantly
              />
              <TouchPointSelectionStrategySelect vwc={selectionStrategyVWC} />
            </div>
          </CrudItemBlock>
        </div>
        <div className={styles.basic}>
          <div className={styles.buttonColumn} ref={(r) => setVWC(saveRef, r)}>
            <RenderGuardedComponent
              props={saveButtonState}
              component={({ disabled, spinner }) => (
                <Button
                  type="button"
                  variant="filled-premium"
                  disabled={disabled}
                  spinner={spinner}
                  onClick={(e) => {
                    e.preventDefault();
                    doSave();
                  }}>
                  Save
                </Button>
              )}
            />
          </div>
        </div>
        <div className={styles.basic}>
          <div className={styles.buttonColumn}>
            <Button
              type="button"
              variant="outlined-danger"
              onClick={async (e) => {
                e.preventDefault();

                const loginContextUnch = loginContextRaw.value.get();
                if (loginContextUnch.state !== 'logged-in') {
                  return;
                }
                const loginContext = loginContextUnch;

                const confirmation = await showYesNoModal(modalContext.modals, {
                  title: 'Permanently Delete?',
                  body:
                    'This is not reversible. Are you absolutely sure you want to delete the touch point with slug ' +
                    touchPoint.eventSlug +
                    '?',
                  cta1: 'Delete',
                  cta2: 'Cancel',
                  emphasize: 2,
                }).promise;

                if (!confirmation) {
                  return;
                }

                try {
                  let response;
                  try {
                    response = await apiFetch(
                      `/api/1/touch_points/${touchPoint.uid}`,
                      { method: 'DELETE' },
                      loginContext
                    );
                  } catch {
                    throw new DisplayableError('connectivity', 'delete touch point');
                  }
                  if (!response.ok) {
                    throw chooseErrorFromStatus(response.status, 'delete touch point');
                  }
                  await showYesNoModal(modalContext.modals, {
                    title: 'Permanently Deleted',
                    body: 'This touch point has been deleted. You will be redirected',
                    cta1: 'OK',
                    emphasize: 2,
                  }).promise;
                  window.location.href = '/admin/touch_points';
                } catch (e) {
                  const err =
                    e instanceof DisplayableError
                      ? e
                      : new DisplayableError('client', 'delete touch point', `${e}`);
                  setVWC(deleteErrorVWC, err);
                }
              }}>
              Delete
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.eventParameters}>
        <CrudItemBlock title="Event Parameter Schema" controls={null}>
          <VerticalSpacer height={8} />
          <RawJSONEditor
            canonicalVWC={eventSchemaVWC}
            setValue={(v) => {
              setVWC(eventSchemaVWC, v);
              setVWC(saveRequiredVWC, true);
            }}
            rows={10}
          />
        </CrudItemBlock>
      </div>
      <CrudItemBlock title="Messages" controls={null} containsNested>
        <TouchPointMessagesSection
          touchPointSchema={eventSchemaVWC}
          messages={messages}
          imageHandler={imageHandler}
        />
      </CrudItemBlock>
    </div>
  );
};
