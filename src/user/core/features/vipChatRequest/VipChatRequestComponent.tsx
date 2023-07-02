import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';
import { FeatureComponentProps } from '../../models/Feature';
import { VipChatRequestResources } from './VipChatRequestResources';
import { VipChatRequestState } from './VipChatRequestState';
import styles from './VipChatRequestComponent.module.css';
import assistiveStyles from '../../../../shared/assistive.module.css';
import { CSSProperties, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Button } from '../../../../shared/forms/Button';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../../shared/ApiConstants';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';

type FnOrString = ((e: React.MouseEvent<HTMLButtonElement>) => void) | string;

function prettyPhoneNumber(pn: string) {
  return pn.replace(/(\+\d)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');
}

export const VipChatRequestComponent = ({
  state,
  resources,
}: FeatureComponentProps<VipChatRequestState, VipChatRequestResources>) => {
  const loginContext = useContext(LoginContext);
  const contentStyle = useMappedValueWithCallbacks(resources, (r) => {
    if (r.windowSize.width <= 439) {
      return { padding: '0 24px' };
    }
    return undefined;
  });

  const doneRef = useRef<boolean>(false);
  const onDone = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      doneRef.current = true;
      e.preventDefault();
      state.get().onDone.call(undefined);
    },
    [state]
  );

  const trackEvent = useCallback(
    (event: 'open' | 'click_cta' | 'click_x' | 'click_done' | 'close_window') => {
      const chatRequest = state.get().chatRequest;
      if (loginContext.state !== 'logged-in' || chatRequest === null || chatRequest === undefined) {
        return;
      }

      if (state.get().suppressEvents) {
        console.log('suppressed tracking event: ' + event);
        return;
      }

      apiFetch(
        '/api/1/vip_chat_requests/actions/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            uid: chatRequest.uid,
            action: event,
          }),
          keepalive: true,
        },
        loginContext
      );
    },
    [loginContext, state]
  );

  const sentDone = useRef(false);
  useEffect(() => {
    if (sentDone.current) {
      return;
    }
    sentDone.current = true;
    trackEvent('open');
  }, [trackEvent]);

  const trackEventRef = useRef(trackEvent);
  trackEventRef.current = trackEvent;

  useEffect(() => {
    if (doneRef.current) {
      return;
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!doneRef.current) {
        trackEventRef.current('close_window');
      }
    }
  }, []);

  const [swappedToPhone, setSwappedToPhone] = useState(false);
  const doSwap = useCallback(() => {
    setSwappedToPhone(true);
  }, []);
  const url = useMappedValuesWithCallbacks([state, resources], (): FnOrString => {
    const chatRequest = state.get().chatRequest;
    if (chatRequest === null || chatRequest === undefined) {
      return '';
    }

    if (resources.get().windowSize.width > 600) {
      return (e) => {
        e.preventDefault();
        setSwappedToPhone(true);
      };
    }

    return `sms://${chatRequest.variant.phoneNumber};?&body=${encodeURI(
      chatRequest.variant.textPrefill
    )}`;
  });

  const onClickX = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      trackEvent('click_x');
      onDone(e);
    },
    [onDone, trackEvent]
  );

  const onClickCta = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      trackEvent('click_cta');
      const handler = url.get();
      if (typeof handler === 'function') {
        handler(e);
      }
    },
    [trackEvent, url]
  );

  const onLinkClickCta = useCallback(
    (e: MouseEvent) => {
      trackEvent('click_cta');
      doSwap();
    },
    [trackEvent, doSwap]
  );

  const onClickDone = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      trackEvent('click_done');
      onDone(e);
    },
    [onDone, trackEvent]
  );

  const background = useMappedValueWithCallbacks(
    resources,
    (r) =>
      r.variant?.background ?? {
        localUrl: null,
        displayWidth: r.windowSize.width,
        displayHeight: r.windowSize.height,
        alt: '',
        loading: true,
        placeholderColor: '#000000',
      }
  );

  const innerProps = useMappedValuesWithCallbacks(
    [state, resources, contentStyle, url],
    (): [VipChatRequestState, VipChatRequestResources, CSSProperties | undefined, FnOrString] => [
      state.get(),
      resources.get(),
      contentStyle.get(),
      url.get(),
    ]
  );

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks state={background} />
      </div>
      <div className={styles.contentOuter}>
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <button type="button" className={styles.close} onClick={onClickX}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </button>
          </div>
        </div>
        <RenderGuardedComponent
          props={innerProps}
          component={([state, resources, contentStyle, url]) => (
            <div className={styles.content} style={contentStyle}>
              <div className={styles.foregroundImageContainer}>
                {resources.variant && <OsehImageFromState {...resources.variant.image} />}
              </div>
              <div className={styles.imageCaption}>{state.chatRequest?.variant?.imageCaption}</div>
              <div className={styles.title}>{state.chatRequest?.variant?.title}</div>
              <div className={styles.message}>{state.chatRequest?.variant?.message}</div>
              <div className={styles.ctaContainer}>
                {!swappedToPhone ? (
                  <Button
                    type="button"
                    variant="filled"
                    onClick={typeof url === 'function' ? onClickCta : url}
                    onLinkClick={onLinkClickCta}
                    fullWidth>
                    {state.chatRequest?.variant?.cta}
                  </Button>
                ) : (
                  <>
                    <div className={styles.swappedPhoneContainer}>
                      <div className={styles.swappedPhone}>
                        {prettyPhoneNumber(state.chatRequest?.variant?.phoneNumber || '')}
                      </div>
                      <div className={styles.swappedSubtext}>Text me!</div>
                    </div>
                    <div className={styles.doneContainer}>
                      <Button type="button" variant="filled" onClick={onClickDone} fullWidth>
                        Done
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
};
