import { PropsWithChildren, ReactElement, useCallback, useContext, useEffect } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  WritableValueWithTypedCallbacks,
  downgradeTypedVWC,
  useWritableValueWithCallbacks,
} from '../../shared/lib/Callbacks';
import { TouchPointEmailMessage, TouchPointPushMessage, TouchPointSmsMessage } from './TouchPoint';
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
import {
  OASObjectDataType,
  OASObjectTypeHint,
  OASSchema,
  OASSimpleDataType,
} from '../../shared/lib/openapi';
import { combineClasses } from '../../shared/lib/combineClasses';
import { Button } from '../../shared/forms/Button';
import { showYesNoModal } from '../../shared/lib/showYesNoModal';
import { createUID } from '../../shared/lib/createUID';
import { R } from 'chart.js/dist/chunks/helpers.core';
import { useErrorModal } from '../../shared/hooks/useErrorModal';
import { describeError } from '../../shared/forms/ErrorBlock';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContext } from '../../shared/contexts/LoginContext';

export type TouchPointMessagesSectionProps = {
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

  const flattenedSchemaVWC = useMappedValueWithCallbacks(templateInfoVWC, (templateInfo) => {
    if (templateInfo === undefined || templateInfo.schema === undefined) {
      return undefined;
    }
    return flattenSchema(templateInfo.schema);
  });

  const templateParametersFixedVWC = useMappedValueWithCallbacks(
    messageVWC,
    (m) => m?.templateParametersFixed ?? {}
  );
  const templateParametersSubstitutedVWC = useMappedValueWithCallbacks(
    messageVWC,
    (m) => m?.templateParametersSubstituted ?? []
  );

  const loginContextRaw = useContext(LoginContext);
  const sendTestErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, sendTestErrorVWC, 'send test email');
  const sendingTestVWC = useWritableValueWithCallbacks(() => false);

  return (
    <div className={styles.modal}>
      <div className={styles.modalFormat}>
        <RenderGuardedComponent
          props={subjectFormatVWC}
          component={(subjectFormat) => (
            <TextInput
              label="Subject Format"
              value={subjectFormat}
              help="Typically, no parameters available. Short (~50 characters) to prevent cutoff. No hard limit."
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

                setMessage({
                  ...msg,
                  template: e.target.value,
                });
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
      <Button
        type="button"
        variant="outlined"
        onClick={async (e) => {
          e.preventDefault();
          const msg = messageVWC.get();
          if (msg === undefined) {
            return;
          }
          const confirmation = await showYesNoModal(modalContext.modals, {
            title: 'Reset Template Parameters?',
            body: 'This will clear all template parameters. You may need to do this after changing templates to one with different parameters. Are you sure?',
            cta1: 'Reset',
            cta2: 'Cancel',
            emphasize: 1,
          }).promise;
          if (!confirmation) {
            return;
          }
          setMessage({
            ...msg,
            templateParametersFixed: {},
            templateParametersSubstituted: [],
          });
        }}>
        Reset Template Parameters
      </Button>
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
                <RenderGuardedComponent
                  props={flattenedSchemaVWC}
                  component={(flatSchema) =>
                    flatSchema === undefined ? (
                      <div>
                        <div className={styles.modalLabel}>Schema</div>
                        <div className={styles.modalHelp}>
                          Schema is too complex for this editor
                        </div>
                      </div>
                    ) : (
                      <>
                        {flatSchema.map(({ path, data, title, description }) => {
                          const key = path.join('.');
                          if (data.type === 'string') {
                            const extra = data as any as { maxLength?: number };
                            return (
                              <div key={key}>
                                <StringParameterEditor
                                  title={title}
                                  description={description}
                                  path={path}
                                  message={messageVWC}
                                  setMessage={setMessage}
                                  maxLength={extra.maxLength}
                                />
                              </div>
                            );
                          }
                          return (
                            <div key={key}>
                              <div className={styles.modalLabel}>{title}</div>
                              <div className={styles.modalHelp}>{description}</div>
                              <div
                                className={combineClasses(styles.modalHelp, styles.modalHelpError)}>
                                Editing currently unsupported for this data type: {data.type}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )
                  }
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
      <RenderGuardedComponent
        props={templateParametersFixedVWC}
        component={(fixed) => (
          <div className={styles.modalParameters}>
            <div className={styles.modalParametersTitle}>Fixed Parameters</div>
            <div className={styles.modalParametersValue}>{JSON.stringify(fixed, undefined, 2)}</div>
          </div>
        )}
      />
      <RenderGuardedComponent
        props={templateParametersSubstitutedVWC}
        component={(substituted) => (
          <div className={styles.modalParameters}>
            <div className={styles.modalParametersTitle}>Substituted Parameters</div>
            <div className={styles.modalParametersValue}>
              {JSON.stringify(substituted, undefined, 2)}
            </div>
          </div>
        )}
      />
    </div>
  );
};

const extractParameters = (message: string): string[] => {
  // we accept curly bracket parameters and do not support any technique for escaping
  const matches = message.match(/{[^}]+}/g);
  if (matches === null) {
    return [];
  }

  return matches.map((m) => m.slice(1, -1));
};

type FlattenedSchema = {
  path: string[];
  data: OASSimpleDataType;
  title: string;
  description: string;
}[];

const flattenSchema = (schema: OASSchema): FlattenedSchema | undefined => {
  // add more support only as necessary
  if (!('type' in schema) || schema.type !== 'object') {
    return undefined;
  }

  const res: FlattenedSchema = [];
  const stack: [string[], OASObjectDataType][] = [[[], schema]];

  while (true) {
    const next = stack.pop();
    if (next === undefined) {
      break;
    }

    const [path, data] = next;
    for (const [key, value] of Object.entries(data.properties)) {
      if (!('type' in value)) {
        console.warn('unsupported property:', value, 'at', path.concat([key]));
        return undefined;
      }

      if (value.type === 'object') {
        stack.push([path.concat([key]), value]);
        continue;
      }

      if (value.type === 'array') {
        console.warn('unsupported property:', value, 'at', path.concat([key]));
        return undefined;
      }

      res.push({
        path: path.concat([key]),
        data: value,
        title: value.title ?? key,
        description: value.description ?? '(no description provided)',
      });
    }
  }

  return res;
};

const StringParameterEditor = (props: {
  title: string;
  description: string;
  path: string[];
  message: ValueWithCallbacks<TouchPointEmailMessage | undefined>;
  setMessage: (msg: TouchPointEmailMessage) => void;
  maxLength?: number;
}): ReactElement => {
  const valueVWC = useMappedValueWithCallbacks(props.message, (message) => {
    if (message === undefined) {
      return '';
    }

    const fixedParams = message.templateParametersFixed;
    let remainingPath = props.path.slice();
    let current: any = fixedParams;
    while (true) {
      let next = remainingPath.shift();
      if (next === undefined) {
        break;
      }
      current = current[next];
      if (current === undefined) {
        break;
      }
    }
    if (current !== undefined) {
      if (typeof current !== 'string') {
        throw new Error(
          'unexpected type in fixed parameter list for ' + JSON.stringify(props.path)
        );
      }
      return current;
    }

    const dynamicParams = message.templateParametersSubstituted;
    for (let i = 0; i < dynamicParams.length; i++) {
      const dynamicParam = dynamicParams[i];
      if (
        dynamicParam.key.length !== props.path.length ||
        dynamicParam.key.some((k, i) => k !== props.path[i])
      ) {
        continue;
      }

      return dynamicParam.format;
    }

    // unset
    return '';
  });

  return (
    <RenderGuardedComponent
      props={valueVWC}
      component={(value) => (
        <TextInput
          label={props.title}
          value={value}
          help={props.description}
          disabled={false}
          inputStyle="normal"
          onChange={(newValue) => {
            const msg = props.message.get();
            if (msg === undefined) {
              return;
            }

            const params = extractParameters(newValue);
            if (params.length === 0) {
              // make sure we're not in the dynamic list
              const dynamicParams = msg.templateParametersSubstituted;
              const dynamicParamsFiltered = dynamicParams.filter(
                (dp) =>
                  dp.key.length !== props.path.length || dp.key.some((k, i) => k !== props.path[i])
              );

              // inject into fixed list, copying as we go
              const fixedParams =
                newValue === ''
                  ? removePath(msg.templateParametersFixed, props.path)
                  : { ...msg.templateParametersFixed };
              if (newValue !== '') {
                let remainingPath = props.path.slice();
                let current: any = fixedParams;
                while (true) {
                  let next = remainingPath.shift();
                  if (next === undefined) {
                    break;
                  }
                  if (remainingPath.length === 0) {
                    current[next] = newValue;
                    break;
                  }
                  current[next] = { ...current[next] };
                  current = current[next];
                }
              }

              props.setMessage({
                ...msg,
                templateParametersFixed: fixedParams,
                templateParametersSubstituted: dynamicParamsFiltered,
              });
            } else {
              const dynamicParams = msg.templateParametersSubstituted;
              const dynamicParamsFiltered = dynamicParams.filter(
                (dp) =>
                  dp.key.length !== props.path.length || dp.key.some((k, i) => k !== props.path[i])
              );
              dynamicParamsFiltered.push({
                key: props.path,
                format: newValue,
                parameters: params,
              });

              const fixedParams = removePath(msg.templateParametersFixed, props.path);
              props.setMessage({
                ...msg,
                templateParametersFixed: fixedParams,
                templateParametersSubstituted: dynamicParamsFiltered,
              });
            }
          }}
          html5Validation={{
            maxLength: props.maxLength,
          }}
        />
      )}
      applyInstantly
    />
  );
};

const removePath = (obj: any, path: string[]): any => {
  if (path.length === 0) {
    return obj;
  }

  const key = path[0];
  if (!(key in obj)) {
    return obj;
  }

  if (path.length === 1) {
    const newObj = { ...obj };
    delete newObj[key];
    return newObj;
  }

  const newObj = { ...obj };
  newObj[key] = removePath(newObj[key], path.slice(1));

  let isEmpty = true;
  for (const _ in newObj[key]) {
    isEmpty = false;
    break;
  }
  if (isEmpty) {
    delete newObj[key];
  }

  return newObj;
};
