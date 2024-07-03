import { PropsWithChildren, ReactElement, useCallback, useContext, useEffect } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  WritableValueWithTypedCallbacks,
  createWritableValueWithCallbacks,
  downgradeTypedVWC,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import {
  TouchPointEmailMessage,
  TouchPointMessageBase,
  TouchPointPushMessage,
  TouchPointSmsMessage,
  TouchPointTemplateParameterSubstitution,
} from './TouchPoint';
import styles from './TouchPointMessagesSection.module.css';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { useValuesWithCallbacksEffect } from '../../shared/hooks/useValuesWithCallbacksEffect';
import { setVWC } from '../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../shared/components/RenderGuardedComponent';
import {
  PriorityDraggableTable,
  PriorityDraggableTableMutationEvent,
} from './components/PriorityDraggableTable';
import { ModalWrapper } from '../../shared/ModalWrapper';
import { ModalContext, addModalWithCallbackToRemove } from '../../shared/contexts/ModalContext';
import { TextInput } from '../../shared/forms/TextInput';
import { useEmailTemplates } from './hooks/useEmailTemplates';
import { useMappedValuesWithCallbacks } from '../../shared/hooks/useMappedValuesWithCallbacks';
import { OASSchema } from '../../shared/lib/openapi';
import { Button } from '../../shared/forms/Button';
import { showYesNoModal } from '../../shared/lib/showYesNoModal';
import { createUID } from '../../shared/lib/createUID';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { describeError } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';
import { walkObject } from './lib/walkObject';
import { deepSet } from './lib/deepSet';
import { TouchPointSchema } from './schema/multiple/TouchPointSchema';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { prettySchemaPath } from '../lib/schema/prettySchemaPath';
import { waitForValueWithCallbacksConditionCancelable } from '../../shared/lib/waitForValueWithCallbacksCondition';
import { createCancelablePromiseFromCallbacks } from '../../shared/lib/createCancelablePromiseFromCallbacks';
import { useValueWithCallbacksEffect } from '../../shared/hooks/useValueWithCallbacksEffect';
import { createCancelableTimeout } from '../../shared/lib/createCancelableTimeout';
import { RawJSONEditor } from '../lib/schema/RawJSONEditor';

export type TouchPointMessagesSectionProps = {
  touchPointSchema: ValueWithCallbacks<any>;
  messages: {
    sms: WritableValueWithTypedCallbacks<
      TouchPointSmsMessage[],
      PriorityDraggableTableMutationEvent<TouchPointSmsMessage> | undefined
    >;
    push: WritableValueWithTypedCallbacks<
      TouchPointPushMessage[],
      PriorityDraggableTableMutationEvent<TouchPointPushMessage> | undefined
    >;
    email: WritableValueWithTypedCallbacks<
      TouchPointEmailMessage[],
      PriorityDraggableTableMutationEvent<TouchPointEmailMessage> | undefined
    >;
  };
  imageHandler: OsehImageStateRequestHandler;
};

/**
 * Visualizes and, if editable, allows editing the messages for a touch point.
 */
export const TouchPointMessagesSection = (props: TouchPointMessagesSectionProps): ReactElement => {
  const tabVWC = useWritableValueWithCallbacks<'sms' | 'push' | 'email'>(() => 'sms');
  const emailTemplatesLoadPreventedVWC = useWritableValueWithCallbacks(() => true);
  const emailTemplatesNR = useEmailTemplates({ loadPrevented: emailTemplatesLoadPreventedVWC });

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <Tab tabVWC={tabVWC} value="sms">
          SMS
        </Tab>
        <Tab tabVWC={tabVWC} value="push">
          Push
        </Tab>
        <Tab tabVWC={tabVWC} value="email">
          Email
        </Tab>
      </div>
      <div className={styles.content}>
        <RenderGuardedComponent
          props={tabVWC}
          component={(tab) => (
            <>
              {tab === 'sms' && <SmsTabContent {...props} />}
              {tab === 'push' && <PushTabContent {...props} />}
              {tab === 'email' && (
                <EmailTabContent
                  {...props}
                  emailTemplatesLoadPreventedVWC={emailTemplatesLoadPreventedVWC}
                  emailTemplatesNR={emailTemplatesNR}
                />
              )}
            </>
          )}
        />
      </div>
    </div>
  );
};

const Tab = <T extends string>({
  tabVWC,
  value,
  children,
}: PropsWithChildren<{
  tabVWC: WritableValueWithCallbacks<T>;
  value: T;
}>) => {
  const selectedVWC = useMappedValueWithCallbacks(tabVWC, (t) => t === value);
  const buttonRef = useWritableValueWithCallbacks<HTMLButtonElement | null>(() => null);
  useValuesWithCallbacksEffect([selectedVWC, buttonRef], () => {
    const btn = buttonRef.get();
    if (btn === null) {
      return undefined;
    }

    const sel = selectedVWC.get();
    if (sel) {
      btn.classList.add(styles.tabSelected);
    } else {
      btn.classList.remove(styles.tabSelected);
    }
    return undefined;
  });

  return (
    <button
      ref={(r) => setVWC(buttonRef, r)}
      className={styles.tab}
      onClick={(e) => {
        e.preventDefault();
        setVWC(tabVWC, value);
      }}>
      {children}
    </button>
  );
};

const SmsTabContent = (props: TouchPointMessagesSectionProps): ReactElement => {
  const modalContext = useContext(ModalContext);

  return (
    <div className={styles.messages}>
      <PriorityDraggableTable
        thead={
          <thead>
            <tr>
              <th scope="col">Body</th>
            </tr>
          </thead>
        }
        items={props.messages.sms}
        render={(message: TouchPointSmsMessage) => (
          <>
            <td>{message.bodyFormat}</td>
          </>
        )}
        priority={{
          get: (message: TouchPointSmsMessage) => message.priority,
          copySet: (message: TouchPointSmsMessage, priority: number) => ({ ...message, priority }),
        }}
        keyFn={(message: TouchPointSmsMessage) => message.uid}
        onExpandRow={(message) => {
          const closeModal = addModalWithCallbackToRemove(
            modalContext.modals,
            <ModalWrapper onClosed={() => closeModal()}>
              <ExpandedSmsModal message={message} items={props.messages.sms} />
            </ModalWrapper>
          );
        }}
      />
      <Button
        type="button"
        variant="outlined"
        onClick={(e) => {
          e.preventDefault();
          const vwc = props.messages.sms;
          const sms = vwc.get();

          const msg = {
            uid: 'oseh_tpsms_' + createUID(),
            priority: sms.length === 0 ? 1 : sms[sms.length - 1].priority + 1,
            bodyFormat: 'New SMS Body',
            bodyParameters: [],
          };
          sms.push(msg);
          vwc.callbacks.call({
            type: 'add',
            index: sms.length - 1,
            item: msg,
          });
        }}>
        Add SMS
      </Button>
    </div>
  );
};

const ExpandedSmsModal = (props: {
  message: TouchPointSmsMessage;
  items: TouchPointMessagesSectionProps['messages']['sms'];
}): ReactElement => {
  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);
  const messageVWC = useMappedValueWithCallbacks(downgradeTypedVWC(props.items), (items) =>
    items.find((i) => i.uid === props.message.uid)
  );
  const setMessage = useCallback(
    (msg: TouchPointSmsMessage) => {
      const items = props.items.get();
      const idx = items.findIndex((i) => i.uid === props.message.uid);
      if (idx === -1) {
        return;
      }
      const original = items[idx];
      items[idx] = msg;
      props.items.callbacks.call({ type: 'replace', index: idx, original, replaced: msg });
    },
    [props.items, props.message.uid]
  );

  const bodyFormatVWC = useMappedValueWithCallbacks(
    messageVWC,
    (message) => message?.bodyFormat ?? ''
  );

  const bodyParametersVWC = useMappedValueWithCallbacks(
    messageVWC,
    (message) => message?.bodyParameters ?? [],
    {
      outputEqualityFn: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    }
  );

  const sendTestErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, sendTestErrorVWC, 'send test sms');

  const sendingTestVWC = useWritableValueWithCallbacks(() => false);

  return (
    <div className={styles.modal}>
      <div className={styles.modalFormat}>
        <RenderGuardedComponent
          props={bodyFormatVWC}
          component={(bodyFormat) => (
            <TextInput
              label="Body Format"
              value={bodyFormat}
              help={
                <>
                  Use {'{url}'} for the url.{' '}
                  <a href="https://twiliodeved.github.io/message-segment-calculator/">
                    1 segment preferred
                  </a>{' '}
                  &mdash; sample link: oseh.io/a/1234
                </>
              }
              disabled={false}
              inputStyle="normal"
              onChange={(newFmt) => {
                const msg = messageVWC.get();
                if (msg === undefined) {
                  return;
                }

                const newParameters = extractParameters(newFmt);

                setMessage({
                  ...msg,
                  bodyFormat: newFmt,
                  bodyParameters: newParameters,
                });
              }}
              html5Validation={{}}
            />
          )}
          applyInstantly
        />
      </div>
      <div className={styles.sendTest}>
        <RenderGuardedComponent
          props={sendingTestVWC}
          component={(working) => (
            <Button
              type="button"
              variant="outlined"
              spinner={working}
              onClick={async (e) => {
                e.preventDefault();
                if (sendingTestVWC.get()) {
                  return;
                }

                const loginContextUnch = loginContextRaw.value.get();
                if (loginContextUnch.state !== 'logged-in') {
                  setVWC(sendTestErrorVWC, <>not logged in</>);
                  return;
                }

                const loginContext = loginContextUnch;

                setVWC(sendTestErrorVWC, null);
                setVWC(sendingTestVWC, true);
                try {
                  const response = await apiFetch(
                    '/api/1/touch_points/send_test_sms',
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                      },
                      body: JSON.stringify({
                        priority: 1,
                        uid: '',
                        body_format: bodyFormatVWC.get(),
                        body_parameters: bodyParametersVWC.get(),
                      }),
                    },
                    loginContext
                  );
                  if (!response.ok) {
                    throw response;
                  }
                  await showYesNoModal(modalContext.modals, {
                    title: 'Test SMS Sent',
                    body: 'A test SMS message has been queued. You should receive it within a few minutes.',
                    cta1: 'OK',
                    emphasize: 1,
                  }).promise;
                } catch (e) {
                  setVWC(sendTestErrorVWC, await describeError(e));
                } finally {
                  setVWC(sendingTestVWC, false);
                }
              }}>
              Send Test
            </Button>
          )}
        />
      </div>
      <div className={styles.delete}>
        <Button
          type="button"
          variant="outlined"
          onClick={(e) => {
            e.preventDefault();
            const msg = messageVWC.get();
            if (msg === undefined) {
              return;
            }
            removeMessage(props.items, msg);
          }}>
          Delete SMS
        </Button>
      </div>
      <RenderGuardedComponent
        props={bodyParametersVWC}
        component={(parameters) => (
          <div className={styles.modalParameters}>
            <div className={styles.modalParametersTitle}>Parameters</div>
            <div className={styles.modalParametersValue}>
              {JSON.stringify(parameters, undefined, 2)}
            </div>
          </div>
        )}
      />
    </div>
  );
};

const PushTabContent = (props: TouchPointMessagesSectionProps): ReactElement => {
  const modalContext = useContext(ModalContext);

  return (
    <div className={styles.messages}>
      <PriorityDraggableTable
        thead={
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Body</th>
            </tr>
          </thead>
        }
        items={props.messages.push}
        render={(message: TouchPointPushMessage) => (
          <>
            <td>{message.titleFormat}</td>
            <td>{message.bodyFormat}</td>
          </>
        )}
        priority={{
          get: (message: TouchPointPushMessage) => message.priority,
          copySet: (message: TouchPointPushMessage, priority: number) => ({ ...message, priority }),
        }}
        keyFn={(message: TouchPointPushMessage) => message.uid}
        onExpandRow={(message) => {
          const closeModal = addModalWithCallbackToRemove(
            modalContext.modals,
            <ModalWrapper onClosed={() => closeModal()}>
              <ExpandedPushModal message={message} items={props.messages.push} />
            </ModalWrapper>
          );
        }}
      />
      <Button
        type="button"
        variant="outlined"
        onClick={(e) => {
          e.preventDefault();
          const vwc = props.messages.push;
          const items = vwc.get();

          const msg: TouchPointPushMessage = {
            uid: 'oseh_tppush_' + createUID(),
            priority: items.length === 0 ? 1 : items[items.length - 1].priority + 1,
            titleFormat: 'New Push Title',
            titleParameters: [],
            bodyFormat: 'New Push Body',
            bodyParameters: [],
            channelId: items.length === 0 ? 'default' : items[0].channelId,
          };
          items.push(msg);
          vwc.callbacks.call({
            type: 'add',
            index: items.length - 1,
            item: msg,
          });
        }}>
        Add Push
      </Button>
    </div>
  );
};

const ExpandedPushModal = (props: {
  message: TouchPointPushMessage;
  items: TouchPointMessagesSectionProps['messages']['push'];
}): ReactElement => {
  const messageVWC = useMappedValueWithCallbacks(downgradeTypedVWC(props.items), (items) =>
    items.find((i) => i.uid === props.message.uid)
  );
  const setMessage = useCallback(
    (msg: TouchPointPushMessage) => {
      const items = props.items.get();
      const idx = items.findIndex((i) => i.uid === props.message.uid);
      if (idx === -1) {
        return;
      }
      const original = items[idx];
      items[idx] = msg;
      props.items.callbacks.call({ type: 'replace', index: idx, original, replaced: msg });
    },
    [props.items, props.message.uid]
  );

  const titleFormatVWC = useMappedValueWithCallbacks(
    messageVWC,
    (message) => message?.titleFormat ?? ''
  );

  const titleParametersVWC = useMappedValueWithCallbacks(
    messageVWC,
    (message) => message?.titleParameters ?? [],
    {
      outputEqualityFn: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    }
  );

  const bodyFormatVWC = useMappedValueWithCallbacks(
    messageVWC,
    (message) => message?.bodyFormat ?? ''
  );

  const bodyParametersVWC = useMappedValueWithCallbacks(
    messageVWC,
    (message) => message?.bodyParameters ?? [],
    {
      outputEqualityFn: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    }
  );

  const channelIdVWC = useMappedValueWithCallbacks(
    messageVWC,
    (message) => message?.channelId ?? 'default'
  );
  const channelIdOptionsVWC = useMappedValueWithCallbacks(
    channelIdVWC,
    (channelId) => {
      const res = ['daily_reminder', 'default'];
      if (!res.includes(channelId)) {
        res.push(channelId);
      }
      res.sort();
      return res;
    },
    {
      outputEqualityFn: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    }
  );

  const modalContext = useContext(ModalContext);
  const loginContextRaw = useContext(LoginContext);
  const sendTestErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, sendTestErrorVWC, 'send test push');
  const sendingTestVWC = useWritableValueWithCallbacks(() => false);

  return (
    <div className={styles.modal}>
      <div className={styles.modalFormat}>
        <RenderGuardedComponent
          props={titleFormatVWC}
          component={(titleFormat) => (
            <TextInput
              label="Title Format"
              value={titleFormat}
              help="Typically, no parameters available. Very short (~20 characters) to prevent cutoff. No hard limit."
              disabled={false}
              inputStyle="normal"
              onChange={(newFmt) => {
                const msg = messageVWC.get();
                if (msg === undefined) {
                  return;
                }

                const newParameters = extractParameters(newFmt);

                setMessage({
                  ...msg,
                  titleFormat: newFmt,
                  titleParameters: newParameters,
                });
              }}
              html5Validation={{}}
            />
          )}
          applyInstantly
        />
      </div>
      <div className={styles.modalFormat}>
        <RenderGuardedComponent
          props={bodyFormatVWC}
          component={(bodyFormat) => (
            <TextInput
              label="Body Format"
              value={bodyFormat}
              help="Typically, no parameters available. Short (~100 characters) to prevent ellipses. No hard limit."
              disabled={false}
              inputStyle="normal"
              onChange={(newFmt) => {
                const msg = messageVWC.get();
                if (msg === undefined) {
                  return;
                }

                const newParameters = extractParameters(newFmt);

                setMessage({
                  ...msg,
                  bodyFormat: newFmt,
                  bodyParameters: newParameters,
                });
              }}
              html5Validation={{}}
            />
          )}
          applyInstantly
        />
      </div>
      <div className={styles.modalSelectContainer}>
        <div className={styles.modalLabel}>Channel (android)</div>
        <RenderGuardedComponent
          props={channelIdVWC}
          component={(channelId) => (
            <select
              className={styles.modalSelect}
              value={channelId}
              onChange={(e) => {
                const msg = messageVWC.get();
                if (msg === undefined) {
                  return;
                }

                setMessage({
                  ...msg,
                  channelId: e.target.value,
                });
              }}>
              <RenderGuardedComponent
                props={channelIdOptionsVWC}
                component={(opts) => (
                  <>
                    {opts.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </>
                )}
              />
            </select>
          )}
        />
      </div>
      <div className={styles.sendTest}>
        <RenderGuardedComponent
          props={sendingTestVWC}
          component={(working) => (
            <Button
              type="button"
              variant="outlined"
              spinner={working}
              onClick={async (e) => {
                e.preventDefault();
                if (sendingTestVWC.get()) {
                  return;
                }

                const loginContextUnch = loginContextRaw.value.get();
                if (loginContextUnch.state !== 'logged-in') {
                  setVWC(sendTestErrorVWC, <>not logged in</>);
                  return;
                }

                const loginContext = loginContextUnch;

                setVWC(sendTestErrorVWC, null);
                setVWC(sendingTestVWC, true);
                try {
                  const response = await apiFetch(
                    '/api/1/touch_points/send_test_push',
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                      },
                      body: JSON.stringify({
                        priority: 1,
                        uid: '',
                        title_format: titleFormatVWC.get(),
                        title_parameters: titleParametersVWC.get(),
                        body_format: bodyFormatVWC.get(),
                        body_parameters: bodyParametersVWC.get(),
                        channel_id: channelIdVWC.get(),
                      }),
                    },
                    loginContext
                  );
                  if (!response.ok) {
                    throw response;
                  }
                  await showYesNoModal(modalContext.modals, {
                    title: 'Test Push Sent',
                    body: 'A test push notification has been queued. You should receive it within a few minutes.',
                    cta1: 'OK',
                    emphasize: 1,
                  }).promise;
                } catch (e) {
                  setVWC(sendTestErrorVWC, await describeError(e));
                } finally {
                  setVWC(sendingTestVWC, false);
                }
              }}>
              Send Test
            </Button>
          )}
        />
      </div>
      <div className={styles.delete}>
        <Button
          type="button"
          variant="outlined"
          onClick={(e) => {
            e.preventDefault();
            const msg = messageVWC.get();
            if (msg === undefined) {
              return;
            }
            removeMessage(props.items, msg);
          }}>
          Delete Push
        </Button>
      </div>
      <RenderGuardedComponent
        props={titleParametersVWC}
        component={(parameters) => (
          <div className={styles.modalParameters}>
            <div className={styles.modalParametersTitle}>Title Parameters</div>
            <div className={styles.modalParametersValue}>
              {JSON.stringify(parameters, undefined, 2)}
            </div>
          </div>
        )}
      />
      <RenderGuardedComponent
        props={bodyParametersVWC}
        component={(parameters) => (
          <div className={styles.modalParameters}>
            <div className={styles.modalParametersTitle}>Body Parameters</div>
            <div className={styles.modalParametersValue}>
              {JSON.stringify(parameters, undefined, 2)}
            </div>
          </div>
        )}
      />
    </div>
  );
};

type EmailTabContentBonusProps = {
  emailTemplatesLoadPreventedVWC: WritableValueWithCallbacks<boolean>;
  emailTemplatesNR: ReturnType<typeof useEmailTemplates>;
  imageHandler: OsehImageStateRequestHandler;
};

const EmailTabContent = (
  props: TouchPointMessagesSectionProps & EmailTabContentBonusProps
): ReactElement => {
  const modalContext = useContext(ModalContext);
  return (
    <div className={styles.messages}>
      <PriorityDraggableTable
        thead={
          <thead>
            <tr>
              <th scope="col">Subject</th>
            </tr>
          </thead>
        }
        items={props.messages.email}
        render={(message: TouchPointEmailMessage) => (
          <>
            <td>{message.subjectFormat}</td>
          </>
        )}
        priority={{
          get: (message: TouchPointEmailMessage) => message.priority,
          copySet: (message: TouchPointEmailMessage, priority: number) => ({
            ...message,
            priority,
          }),
        }}
        keyFn={(message: TouchPointEmailMessage) => message.uid}
        onExpandRow={(message) => {
          const closeModal = addModalWithCallbackToRemove(
            modalContext.modals,
            <ModalWrapper onClosed={() => closeModal()}>
              <ExpandedEmailModal
                message={message}
                items={props.messages.email}
                emailTemplatesLoadPreventedVWC={props.emailTemplatesLoadPreventedVWC}
                emailTemplatesNR={props.emailTemplatesNR}
                touchPointSchema={props.touchPointSchema}
                imageHandler={props.imageHandler}
              />
            </ModalWrapper>
          );
        }}
      />
      <Button
        type="button"
        variant="outlined"
        onClick={(e) => {
          e.preventDefault();
          const vwc = props.messages.email;
          const items = vwc.get();

          const msg: TouchPointEmailMessage = {
            uid: 'oseh_tpem_' + createUID(),
            priority: items.length === 0 ? 1 : items[items.length - 1].priority + 1,
            subjectFormat: 'New Email Subject',
            subjectParameters: [],
            template: items.length === 0 ? 'sample' : items[0].template,
            templateParametersFixed: {},
            templateParametersSubstituted:
              items.length === 0 ? [] : [...items[0].templateParametersSubstituted],
          };
          items.push(msg);
          vwc.callbacks.call({
            type: 'add',
            index: items.length - 1,
            item: msg,
          });
        }}>
        Add Email
      </Button>
    </div>
  );
};

const ExpandedEmailModal = (
  props: {
    message: TouchPointEmailMessage;
    items: TouchPointMessagesSectionProps['messages']['email'];
    touchPointSchema: ValueWithCallbacks<any>;
  } & EmailTabContentBonusProps
): ReactElement => {
  const modalContext = useContext(ModalContext);

  useEffect(() => {
    setVWC(props.emailTemplatesLoadPreventedVWC, false);
  });

  const messageVWC = useMappedValueWithCallbacks(downgradeTypedVWC(props.items), (items) =>
    items.find((i) => i.uid === props.message.uid)
  );
  const setMessage = useCallback(
    (msg: TouchPointEmailMessage) => {
      const items = props.items.get();
      const idx = items.findIndex((i) => i.uid === props.message.uid);
      if (idx === -1) {
        return;
      }
      const original = items[idx];
      items[idx] = msg;
      props.items.callbacks.call({ type: 'replace', index: idx, original, replaced: msg });
    },
    [props.items, props.message.uid]
  );

  const subjectFormatVWC = useMappedValueWithCallbacks(
    messageVWC,
    (message) => message?.subjectFormat ?? ''
  );

  const subjectParametersVWC = useMappedValueWithCallbacks(
    messageVWC,
    (message) => message?.subjectParameters ?? [],
    {
      outputEqualityFn: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    }
  );

  const templatesVWC = useMappedValuesWithCallbacks(
    [props.emailTemplatesNR, messageVWC],
    () => {
      const templates = props.emailTemplatesNR.get();
      const msg = messageVWC.get();

      if (msg === undefined) {
        return [];
      }

      if (templates.type !== 'success') {
        return [msg.template];
      }

      const slugs = Object.keys(templates.result.bySlug);
      if (!slugs.includes(msg.template)) {
        slugs.push(msg.template);
      }

      slugs.sort();
      return slugs;
    },
    {
      outputEqualityFn: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    }
  );

  const templateVWC = useMappedValueWithCallbacks(messageVWC, (message) => message?.template ?? '');
  const templateInfoVWC = useMappedValuesWithCallbacks(
    [props.emailTemplatesNR, templateVWC],
    () => {
      const templates = props.emailTemplatesNR.get();
      if (templates.type !== 'success') {
        return undefined;
      }
      return templates.result.bySlug[templateVWC.get()];
    }
  );

  const schemaVWC = useMappedValueWithCallbacks(templateInfoVWC, (templateInfo) => {
    if (templateInfo === undefined || templateInfo.schema === undefined) {
      return undefined;
    }
    return templateInfo.schema as any;
  });

  const templateParametersFixedVWC = useMappedValueWithCallbacks(
    messageVWC,
    (m) => (m?.templateParametersFixed ?? {}) as any
  );
  const templateParametersSubstitutedVWC = useMappedValueWithCallbacks(
    messageVWC,
    (m) => m?.templateParametersSubstituted ?? []
  );
  const templateParametersSubstitutedMapVWC = useMappedValueWithCallbacks(
    templateParametersSubstitutedVWC,
    (arr) => {
      const result = new Map<string, TouchPointTemplateParameterSubstitution>();
      for (const item of arr) {
        result.set(prettySchemaPath(item.key), item);
      }
      return result;
    }
  );

  const loginContextRaw = useContext(LoginContext);
  const sendTestErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, sendTestErrorVWC, 'send test email');
  const sendingTestVWC = useWritableValueWithCallbacks(() => false);

  const paramsByTemplateVWC = useWritableValueWithCallbacks<
    Map<
      string,
      {
        fixed: Record<string, unknown>;
        substituted: TouchPointTemplateParameterSubstitution[];
      }
    >
  >(() => new Map());

  const wantPreviewWindowVWC = useWritableValueWithCallbacks(() => false);
  const previewErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, previewErrorVWC, 'preview email');

  useValuesWithCallbacksEffect(
    [wantPreviewWindowVWC, loginContextRaw.value, templateVWC, props.touchPointSchema],
    () => {
      if (!wantPreviewWindowVWC.get()) {
        return undefined;
      }

      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        setVWC(previewErrorVWC, <>not logged in</>);
        return undefined;
      }

      const exampleProps = props.touchPointSchema.get()?.example;
      if (exampleProps === null || exampleProps === undefined) {
        setVWC(previewErrorVWC, <>no example of touch event parameters found</>);
        return undefined;
      }

      const loginContext = loginContextUnch;
      const templateSlug = templateVWC.get();
      setVWC(previewErrorVWC, null);

      let popupRaw;
      try {
        popupRaw = window.open('', 'popup', 'width=430, height=932');
      } catch (e) {
        setVWC(wantPreviewWindowVWC, false);
        setVWC(previewErrorVWC, <>failed to open popup: {e}</>);
        return undefined;
      }

      if (popupRaw === null) {
        setVWC(wantPreviewWindowVWC, false);
        setVWC(previewErrorVWC, <>failed to open popup (null window)</>);
        return undefined;
      }

      const popup = popupRaw;
      const popupLoaded = createWritableValueWithCallbacks(false);
      popup.window.onload = () => {
        setVWC(popupLoaded, true);
      };
      if (popup.document.readyState === 'complete') {
        setVWC(popupLoaded, true);
      }

      popup.window.onbeforeunload = () => {
        if (!active.get()) {
          return;
        }

        setVWC(wantPreviewWindowVWC, false);
      };

      const active = createWritableValueWithCallbacks(true);
      const emailTemplateJWT = createWritableValueWithCallbacks<string | null>(null);
      acquireJWT();
      writeContent();
      manageClosingPopup();
      return () => {
        setVWC(active, false);
      };

      async function acquireJWT() {
        const done = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);
        const controller = new AbortController();
        const signal = controller.signal;
        done.promise.then(
          () => controller.abort(),
          () => controller.abort()
        );

        try {
          const response = await apiFetch(
            '/api/1/emails/authorize_templating',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                template_slug: templateSlug,
              }),
              signal,
            },
            loginContext
          );
          if (!response.ok) {
            throw response;
          }
          const body: { jwt: string } = await response.json();
          setVWC(emailTemplateJWT, body.jwt);
        } catch (e) {
          if (!signal.aborted) {
            setVWC(wantPreviewWindowVWC, false);
            setVWC(previewErrorVWC, await describeError(e));
          }
          return;
        } finally {
          done.cancel();
        }
      }

      async function writeContent() {
        const done = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);
        done.promise.catch(() => {});

        const loaded = waitForValueWithCallbacksConditionCancelable(popupLoaded, (v) => v);
        loaded.promise.catch(() => {});

        const jwtCancelable = waitForValueWithCallbacksConditionCancelable(
          emailTemplateJWT,
          (v) => v !== null
        );
        jwtCancelable.promise.catch(() => {});
        try {
          await Promise.race([done.promise, Promise.all([loaded.promise, jwtCancelable.promise])]);
        } catch {
        } finally {
          loaded.cancel();
          jwtCancelable.cancel();
        }

        if (!active.get()) {
          return;
        }

        const jwt = await jwtCancelable.promise;

        while (true) {
          if (!active.get()) {
            break;
          }

          const minDelay = createCancelableTimeout(500);
          const changedCancelable = createCancelablePromiseFromCallbacks(messageVWC.callbacks);
          changedCancelable.promise.catch(() => {});
          const message = messageVWC.get();
          if (message === undefined) {
            try {
              await Promise.race([changedCancelable.promise, done.promise]);
            } catch {}
            changedCancelable.cancel();
            minDelay.cancel();
            continue;
          }

          const controller = new AbortController();
          const signal = controller.signal;
          const doAbort = () => controller.abort();
          active.callbacks.add(doAbort);
          changedCancelable.promise.finally(() => {
            doAbort();
          });
          if (!active.get()) {
            doAbort();
          }
          try {
            const templateParams = deepCopy(message.templateParametersFixed);
            for (const item of message.templateParametersSubstituted) {
              deepSet(templateParams, item.key, pythonFormat(item.format, exampleProps));
            }

            const url = `/api/3/templates/${templateSlug}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                Accept: 'text/html; charset=utf-8',
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `Bearer ${jwt}`,
              },
              body: JSON.stringify(templateParams),
              signal,
            });
            if (response.status !== 422) {
              if (!response.ok) {
                throw response;
              }
              const emailHtml = await response.text();

              popup.document.open();
              popup.document.write(emailHtml);
              popup.document.close();
            }
          } catch (e) {
            if (!active.get()) {
              changedCancelable.cancel();
              minDelay.cancel();
              continue;
            }

            if (changedCancelable.done()) {
              await minDelay.promise;
              continue;
            }

            console.trace('had an error trying to preview emaisl', e);
            setVWC(previewErrorVWC, await describeError(e));
            break;
          } finally {
            active.callbacks.remove(doAbort);
          }

          try {
            await Promise.all([
              Promise.race([changedCancelable.promise, done.promise]),
              minDelay.promise,
            ]);
          } catch {}
          changedCancelable.cancel();
        }

        done.cancel();
        popup.document.open();
        popup.document.write('<html><body>disconnected</body></html>');
        popup.document.close();
      }

      async function manageClosingPopup() {
        await waitForValueWithCallbacksConditionCancelable(active, (v) => !v).promise;
        popup.close();
      }
    }
  );

  return (
    <div className={styles.modal}>
      <div className={styles.modalFormat}>
        <RenderGuardedComponent
          props={subjectFormatVWC}
          component={(subjectFormat) => (
            <TextInput
              label="Subject Format"
              value={subjectFormat}
              help="Short (~50 characters) to prevent cutoff. No hard limit."
              disabled={false}
              inputStyle="normal"
              onChange={(newFmt) => {
                const msg = messageVWC.get();
                if (msg === undefined) {
                  return;
                }

                const newParameters = extractParameters(newFmt);

                setMessage({
                  ...msg,
                  subjectFormat: newFmt,
                  subjectParameters: newParameters,
                });
              }}
              html5Validation={{}}
            />
          )}
          applyInstantly
        />
      </div>
      <div className={styles.modalSelectContainer}>
        <div className={styles.modalLabel}>Template</div>
        <RenderGuardedComponent
          props={templateVWC}
          component={(template) => (
            <select
              className={styles.modalSelect}
              value={template}
              onChange={(e) => {
                const msg = messageVWC.get();
                if (msg === undefined) {
                  return;
                }

                const newTemplate = e.target.value;

                const paramsByTemplate = paramsByTemplateVWC.get();
                paramsByTemplate.set(msg.template, {
                  fixed: msg.templateParametersFixed,
                  substituted: msg.templateParametersSubstituted,
                });
                paramsByTemplateVWC.callbacks.call(undefined);

                const stored = paramsByTemplate.get(newTemplate);
                if (stored !== undefined) {
                  setMessage({
                    ...msg,
                    template: newTemplate,
                    templateParametersFixed: stored.fixed,
                    templateParametersSubstituted: stored.substituted,
                  });
                  return;
                }

                let newMessage: TouchPointEmailMessage = {
                  ...msg,
                  template: newTemplate,
                  templateParametersFixed: {},
                  templateParametersSubstituted: [],
                };
                const allTemplates = props.emailTemplatesNR.get();
                if (allTemplates.type !== 'success') {
                  setMessage(newMessage);
                  return;
                }

                const newTemplateInfo = allTemplates.result.bySlug[newTemplate];
                const example = newTemplateInfo?.schema?.example ?? {};
                walkObject(example, (path, data) => {
                  if (typeof data === 'string') {
                    const parameters = extractParameters(data);
                    if (parameters.length === 0) {
                      deepSet(newMessage.templateParametersFixed, path, data);
                    } else {
                      if (path.some((v) => typeof v !== 'string')) {
                        throw new Error(`unsupported substitition path target: ${path}`);
                      }
                      newMessage.templateParametersSubstituted.push({
                        key: path as string[],
                        format: data,
                        parameters,
                      });
                    }
                  } else {
                    deepSet(newMessage.templateParametersFixed, path, data);
                  }
                });

                setMessage(newMessage);
              }}>
              <RenderGuardedComponent
                props={templatesVWC}
                component={(templates) => (
                  <>
                    {templates.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </>
                )}
              />
            </select>
          )}
        />
      </div>
      <RenderGuardedComponent
        props={templateInfoVWC}
        component={(templateInfo) =>
          templateInfo === undefined ? (
            <></>
          ) : (
            <div className={styles.modalTemplateInfo}>
              <div>
                <div className={styles.modalLabel}>Summary</div>
                <div className={styles.modalHelp}>{templateInfo.summary}</div>
              </div>
              <div>
                <div className={styles.modalLabel}>Description</div>
                <div className={styles.modalHelp}>{templateInfo.description}</div>
              </div>

              {templateInfo.schema === undefined ? (
                <div>
                  <div className={styles.modalLabel}>Schema</div>
                  <div className={styles.modalHelp}>No schema available</div>
                </div>
              ) : (
                <TouchPointSchema
                  schema={templateInfo.schema}
                  value={{
                    get: templateParametersFixedVWC.get,
                    callbacks: templateParametersFixedVWC.callbacks,
                    set: (v) => {
                      const msg = messageVWC.get();
                      if (msg === undefined) {
                        return;
                      }

                      setMessage({
                        ...msg,
                        templateParametersFixed: v,
                      });
                    },
                  }}
                  imageHandler={props.imageHandler}
                  variable={{
                    get: templateParametersSubstitutedMapVWC.get,
                    callbacks: templateParametersSubstitutedMapVWC.callbacks,
                    set: (v) => {
                      const msg = messageVWC.get();
                      if (msg === undefined) {
                        return;
                      }

                      setMessage({
                        ...msg,
                        templateParametersSubstituted: Array.from(v.values()).sort((a, b) => {
                          for (let i = 0; i < a.key.length && i < b.key.length; i++) {
                            const aVal = a.key[i];
                            const bVal = b.key[i];

                            if (typeof aVal === 'string' || typeof bVal === 'string') {
                              const cmp = `${aVal}`.localeCompare(`${bVal}`);
                              if (cmp !== 0) {
                                return cmp;
                              }
                            }

                            if (aVal < bVal) {
                              return -1;
                            } else if (aVal > bVal) {
                              return 1;
                            }
                          }

                          if (a.key.length < b.key.length) {
                            return -1;
                          }
                          if (a.key.length > b.key.length) {
                            return 1;
                          }
                          return 0;
                        }),
                      });
                    },
                  }}
                />
              )}
            </div>
          )
        }
      />
      <div className={styles.sendTest}>
        <RenderGuardedComponent
          props={sendingTestVWC}
          component={(working) => (
            <Button
              type="button"
              variant="outlined"
              spinner={working}
              onClick={async (e) => {
                e.preventDefault();
                if (sendingTestVWC.get()) {
                  return;
                }

                const loginContextUnch = loginContextRaw.value.get();
                if (loginContextUnch.state !== 'logged-in') {
                  setVWC(sendTestErrorVWC, <>not logged in</>);
                  return;
                }

                const loginContext = loginContextUnch;

                setVWC(sendTestErrorVWC, null);
                setVWC(sendingTestVWC, true);
                try {
                  const response = await apiFetch(
                    '/api/1/touch_points/send_test_email',
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                      },
                      body: JSON.stringify({
                        priority: 1,
                        uid: '',
                        subject_format: subjectFormatVWC.get(),
                        subject_parameters: subjectParametersVWC.get(),
                        template: templateVWC.get(),
                        template_parameters_fixed: templateParametersFixedVWC.get(),
                        template_parameters_substituted: templateParametersSubstitutedVWC.get(),
                      }),
                    },
                    loginContext
                  );
                  if (!response.ok) {
                    throw response;
                  }
                  await showYesNoModal(modalContext.modals, {
                    title: 'Test Email Sent',
                    body: 'A test email has been queued. You should receive it within a few minutes.',
                    cta1: 'OK',
                    emphasize: 1,
                  }).promise;
                } catch (e) {
                  setVWC(sendTestErrorVWC, await describeError(e));
                } finally {
                  setVWC(sendingTestVWC, false);
                }
              }}>
              Send Test
            </Button>
          )}
        />
      </div>
      <div className={styles.delete}>
        <Button
          type="button"
          variant="outlined"
          onClick={(e) => {
            e.preventDefault();
            const msg = messageVWC.get();
            if (msg === undefined) {
              return;
            }
            removeMessage(props.items, msg);
          }}>
          Delete Email
        </Button>
      </div>
      <div className={styles.preview}>
        <RenderGuardedComponent
          props={wantPreviewWindowVWC}
          component={(wantPreview) => (
            <Button
              type="button"
              variant="outlined"
              onClick={(e) => {
                e.preventDefault();
                setVWC(wantPreviewWindowVWC, !wantPreview);
              }}>
              {wantPreview ? 'Close Preview' : 'Preview Email'}
            </Button>
          )}
        />
      </div>
      <RenderGuardedComponent
        props={subjectParametersVWC}
        component={(parameters) => (
          <div className={styles.modalParameters}>
            <div className={styles.modalParametersTitle}>Subject Parameters</div>
            <div className={styles.modalParametersValue}>
              {JSON.stringify(parameters, undefined, 2)}
            </div>
          </div>
        )}
      />
      <div className={styles.modalParameters}>
        <div className={styles.modalParametersTitle}>Fixed Parameters</div>
        <RawJSONEditor
          canonicalVWC={templateParametersFixedVWC}
          setValue={(v) => {
            const msg = messageVWC.get();
            if (msg === undefined) {
              return;
            }

            setMessage({
              ...msg,
              templateParametersFixed: v,
            });
          }}
          rows={10}
        />
        <div className={styles.modalParameters}>
          <div className={styles.modalParametersTitle}>Substituted Parameters</div>
          <RawJSONEditor
            canonicalVWC={templateParametersSubstitutedVWC}
            setValue={(v) => {
              const msg = messageVWC.get();
              if (msg === undefined) {
                return;
              }

              setMessage({
                ...msg,
                templateParametersSubstituted: v,
              });
            }}
            rows={10}
          />
        </div>
      </div>
    </div>
  );
};

const extractParameters = (message: string): string[] => {
  // we accept curly bracket parameters and do not support any technique for escaping
  const matches = message.match(/{[^}]+}/g);
  if (matches === null) {
    return [];
  }

  return matches.map((m) => m.slice(1, -1)).map((s) => pythonToDot(s));
};

/**
 * Converts a python style parameter reference foo[bar][baz] to
 * dots foo.bar.baz
 */
const pythonToDot = (pyParam: string): string => {
  return pyParam.replace(/\[/g, '.').replace(/\]/g, '');
};

const removeMessage = <T extends TouchPointMessageBase>(
  vwc: WritableValueWithTypedCallbacks<T[], PriorityDraggableTableMutationEvent<T> | undefined>,
  msg: T
) => {
  const items = vwc.get();
  const idx = items.findIndex((i) => i.uid === msg.uid);
  if (idx === -1) {
    return;
  }
  items.splice(idx, 1);

  if (
    (idx === 0 || items[idx - 1].priority !== msg.priority) &&
    (idx === items.length || items[idx].priority !== msg.priority)
  ) {
    for (let i = idx; i < items.length; i++) {
      items[i] = { ...items[i], priority: items[i].priority - 1 };
    }
    vwc.callbacks.call({
      type: 'remove',
      scenario: 'decreaseHigher',
      index: idx,
      item: msg,
    });
  } else {
    vwc.callbacks.call({
      type: 'remove',
      scenario: 'simple',
      index: idx,
      item: msg,
    });
  }
};

const deepCopy = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepCopy);
  }

  const newObj: any = {};
  for (const key in obj) {
    newObj[key] = deepCopy(obj[key]);
  }
  return newObj;
};

const pythonFormat = (format: string, parameters: any) => {
  let result = '';

  let finishedUpTo = 0;
  while (true) {
    const open = format.indexOf('{', finishedUpTo);
    if (open === -1) {
      break;
    }

    const close = format.indexOf('}', open);
    if (close === -1) {
      break;
    }

    result += format.slice(finishedUpTo, open);
    finishedUpTo = close + 1;

    // foo[bar][baz]:hint!
    const pythonStyleSubstitution = format.slice(open + 1, close);
    const pythonStylePath = pythonStyleSubstitution.split(':').shift();
    if (pythonStylePath === undefined) {
      result += `{${pythonStyleSubstitution}}`;
      continue;
    }

    // foo.bar.baz
    const dotStylePath = pythonToDot(pythonStylePath);
    const pathKey = dotStylePath.split('.');
    const value = deepGet(parameters, pathKey);
    result += `${value}`;
  }

  result += format.slice(finishedUpTo);
  return result;
};

const deepGet = (o: any, key: string[]) => {
  if (o === null || typeof o !== 'object') {
    return undefined;
  }

  let current = o;
  for (const k of key) {
    if (!(k in current)) {
      return undefined;
    }
    current = current[k];
  }
  return current;
};
