import { OsehImageFromState } from '../../../../shared/OsehImage';
import { OnboardingStepComponentProps } from '../../models/OnboardingStep';
import { VipChatRequestResources } from './VipChatRequestResources';
import { VipChatRequestState } from './VipChatRequestState';
import styles from './VipChatRequestComponent.module.css';
import assistiveStyles from '../../../../shared/assistive.module.css';
import {
  CSSProperties,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '../../../../shared/forms/Button';
import { LoginContext } from '../../../../shared/LoginContext';
import { apiFetch } from '../../../../shared/ApiConstants';

type FnOrString = ((e: React.MouseEvent<HTMLButtonElement>) => void) | string;

function prettyPhoneNumber(pn: string) {
  return pn.replace(/(\+\d)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4');
}

export const VipChatRequestComponent = ({
  state,
  resources,
  doAnticipateState,
}: OnboardingStepComponentProps<VipChatRequestState, VipChatRequestResources>) => {
  const loginContext = useContext(LoginContext);
  const contentStyle = useMemo<CSSProperties | undefined>(() => {
    if (resources.windowSize.width <= 439) {
      return { padding: '0 24px' };
    }
    return undefined;
  }, [resources.windowSize]);

  const doneRef = useRef<boolean>(false);
  const onDone = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      doneRef.current = true;
      e.preventDefault();
      const newState = state.onDone.call(undefined);
      doAnticipateState(newState, Promise.resolve());
    },
    [doAnticipateState, state.onDone]
  );

  const trackEvent = useCallback(
    (event: 'open' | 'click_cta' | 'click_x' | 'click_done' | 'close_window') => {
      if (
        loginContext.state !== 'logged-in' ||
        state.chatRequest === null ||
        state.chatRequest === undefined
      ) {
        return;
      }

      if (state.suppressEvents) {
        console.log('suppressed tracking event: ' + event);
        return;
      }

      apiFetch(
        '/api/1/vip_chat_requests/actions/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            uid: state.chatRequest.uid,
            action: event,
          }),
          keepalive: true,
        },
        loginContext
      );
    },
    [state.suppressEvents, loginContext, state.chatRequest]
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
  const url = useMemo<FnOrString>(() => {
    if (state.chatRequest === null || state.chatRequest === undefined) {
      return '';
    }

    if (resources.windowSize.width > 600) {
      return (e) => {
        e.preventDefault();
        setSwappedToPhone(true);
      };
    }

    return `sms://${state.chatRequest.variant.phoneNumber};?&${new URLSearchParams({
      body: state.chatRequest.variant.textPrefill,
    })}`;
  }, [state, resources.windowSize]);

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
      if (typeof url === 'function') {
        url(e);
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

  if (resources.variant === null || state.chatRequest === null || state.chatRequest === undefined) {
    return <></>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...resources.variant.background} />
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
        <div className={styles.content} style={contentStyle}>
          <div className={styles.foregroundImageContainer}>
            <OsehImageFromState {...resources.variant.image} />
          </div>
          <div className={styles.imageCaption}>{state.chatRequest.variant.imageCaption}</div>
          <div className={styles.title}>{state.chatRequest.variant.title}</div>
          <div className={styles.message}>{state.chatRequest.variant.message}</div>
          <div className={styles.ctaContainer}>
            {!swappedToPhone ? (
              <Button
                type="button"
                variant="filled"
                onClick={typeof url === 'function' ? onClickCta : url}
                onLinkClick={onLinkClickCta}
                fullWidth>
                {state.chatRequest.variant.cta}
              </Button>
            ) : (
              <>
                <div className={styles.swappedPhoneContainer}>
                  <div className={styles.swappedPhone}>
                    {prettyPhoneNumber(state.chatRequest.variant.phoneNumber)}
                  </div>
                  <div className={styles.swappedSubtext}>Text me!</div>
                </div>
                <div className={styles.doneContainer}>
                  <Button type="button" variant="link-white" onClick={onClickDone} fullWidth>
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
