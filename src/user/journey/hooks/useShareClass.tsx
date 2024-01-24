import { ReactElement, useCallback, useContext, useMemo } from 'react';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../../../shared/anim/VariableStrategyProps';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { ModalContext, addModalWithCallbackToRemove } from '../../../shared/contexts/ModalContext';
import { setVWC } from '../../../shared/lib/setVWC';
import { describeError } from '../../../shared/forms/ErrorBlock';
import { apiFetch } from '../../../shared/ApiConstants';
import { SlideInModal } from '../../../shared/components/SlideInModal';
import styles from './useShareClass.module.css';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { IconButtonWithLabel } from '../../../shared/forms/IconButtonWithLabel';
import { useValueWithCallbacksEffect } from '../../../shared/hooks/useValueWithCallbacksEffect';
import { useValuesWithCallbacksEffect } from '../../../shared/hooks/useValuesWithCallbacksEffect';

export type UseShareClassProps = {
  /**
   * The journey to share
   */
  journey: VariableStrategyProps<{ uid: string }>;
};

export type UseShareClassResult = {
  /**
   * The function to call to trigger sharing the class. Returns a function
   * which can be used to request the current share be canceled, if we're
   * still working on it.
   *
   * This will attempt to share the class even if we know it's not shareable
   */
  shareClass: () => () => void;

  /**
   * True if the class is shareable, false if the class is not shareable,
   * undefined if we're unsure
   */
  shareable: WritableValueWithCallbacks<boolean | undefined>;

  /**
   * The last error that occurred, as can be presented to the user
   */
  error: WritableValueWithCallbacks<ReactElement | null>;

  /**
   * True if we are working on sharing the class, false otherwise
   */
  working: ValueWithCallbacks<boolean>;
};

/**
 * Creates a function which can share a specific class. This requires a login
 * context and modal context.
 */
export const useShareClass = ({ journey }: UseShareClassProps): UseShareClassResult => {
  const loginContextRaw = useContext(LoginContext);
  const modalContext = useContext(ModalContext);
  const journeyVWC = useVariableStrategyPropsAsValueWithCallbacks(journey);
  const error = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const shareable = useWritableValueWithCallbacks<boolean | undefined>(() => undefined);
  const lastLink = useWritableValueWithCallbacks<{ uid: string; link: string } | null>(() => null);

  useValuesWithCallbacksEffect([journeyVWC, loginContextRaw.value], () => {
    const journey = journeyVWC.get();
    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return undefined;
    }
    const loginContext = loginContextUnch;

    let running = true;
    const cancelers = new Callbacks<undefined>();
    checkShareable();
    return () => {
      running = false;
      cancelers.call(undefined);
    };

    async function checkShareableInner() {
      const controller = window.AbortController ? new window.AbortController() : undefined;
      const signal = controller?.signal;
      const doAbort = () => {
        controller?.abort();
      };

      cancelers.add(doAbort);
      if (!running) {
        cancelers.remove(doAbort);
        return;
      }

      const response = await apiFetch(
        '/api/1/journeys/check_if_shareable',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            uid: journey.uid,
          }),
          signal,
        },
        loginContext
      );

      if (!response.ok) {
        if (response.status === 404) {
          setVWC(shareable, false);
        }
        throw response;
      }

      if (!running) {
        return;
      }

      const data: { shareable: boolean } = await response.json();
      setVWC(shareable, data.shareable);
    }

    async function checkShareable() {
      if (!running) {
        return;
      }

      setVWC(shareable, undefined);
      try {
        await checkShareableInner();
      } catch (e) {
        if (running) {
          console.log('failed to determine if shareable:', e);
        }
      }
    }
  });

  const working = useWritableValueWithCallbacks(() => false);
  const shareClass = useCallback(() => {
    if (working.get()) {
      return () => {};
    }

    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return () => {};
    }

    const loginContext = loginContextUnch;

    setVWC(working, true);
    const running = createWritableValueWithCallbacks(true);
    handleShare(journeyVWC.get().uid);

    return () => {
      setVWC(running, false);
    };

    async function openShareModalFallback(link: string, retryableInitial: boolean): Promise<void> {
      if (!running.get()) {
        return;
      }

      const disabled = createWritableValueWithCallbacks<boolean>(true);
      const requestClose = createWritableValueWithCallbacks<() => void>(() => {});
      const recentlyCopied = createWritableValueWithCallbacks<boolean>(false);
      const copyFailed = createWritableValueWithCallbacks<boolean>(false);
      const retryable = createWritableValueWithCallbacks<boolean>(retryableInitial);

      const tryCopyLink = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        if (recentlyCopiedTimeout !== null) {
          clearTimeout(recentlyCopiedTimeout);
          recentlyCopiedTimeout = null;
        }

        setVWC(recentlyCopied, false);
        try {
          window.navigator.clipboard.writeText(link);
          setVWC(recentlyCopied, true);

          if (recentlyCopiedTimeout !== null) {
            clearTimeout(recentlyCopiedTimeout);
            recentlyCopiedTimeout = null;
          }

          recentlyCopiedTimeout = setTimeout(() => {
            setVWC(recentlyCopied, false);
            recentlyCopiedTimeout = null;
          }, 3000);
        } catch (e) {
          console.log('failed to copy:', e);
          setVWC(copyFailed, true);
        }
      };

      let recentlyCopiedTimeout: NodeJS.Timeout | null = null;

      let resolveOnModalClosed: () => void = () => {};
      const onModalClosed = new Promise<void>((resolve) => {
        resolveOnModalClosed = resolve;
      });

      const handleOnShareClass = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        try {
          console.log('trying native share to share link:', link);
          await window.navigator.share({
            url: link,
          });
        } catch (e) {
          console.log('failed to native share with valid context:', e);

          let message: string | undefined = undefined;
          if (e instanceof Error) {
            message = e.message;
          } else if (
            typeof e === 'object' &&
            e !== null &&
            'message' in e &&
            typeof (e as any).message === 'string'
          ) {
            message = (e as any).message;
          }

          if (message === undefined || !message.startsWith('AbortError')) {
            setVWC(retryable, false);
          }
        }
      };

      const removeModal = addModalWithCallbackToRemove(
        modalContext.modals,
        <SlideInModal
          title="Share Class"
          requestClose={requestClose}
          onClosed={() => {
            resolveOnModalClosed();
          }}
          animating={disabled}>
          <RenderGuardedComponent
            props={disabled}
            component={(isDisabled) => {
              return (
                <div
                  className={combineClasses(
                    styles.container,
                    isDisabled ? styles.disablePointerEvents : undefined
                  )}>
                  <div className={styles.content}>
                    <div className={styles.copyContainer}>
                      <div className={styles.title}>Use the following link:</div>
                      <div className={styles.linkContainer}>
                        <RenderGuardedComponent
                          props={copyFailed}
                          component={(failed) => {
                            if (failed) {
                              // if copying failed, use a simpler dom in case we're making
                              // it harder for them to copy
                              return <div className={styles.link}>{link}</div>;
                            }

                            return (
                              <button
                                type="button"
                                onClick={tryCopyLink}
                                disabled={isDisabled}
                                className={styles.link}>
                                <RenderGuardedComponent
                                  props={recentlyCopied}
                                  component={(copied) => (copied ? <>Copied!</> : <>{link}</>)}
                                />
                              </button>
                            );
                          }}
                        />
                      </div>
                    </div>
                    <RenderGuardedComponent
                      props={retryable}
                      component={(retryable) =>
                        retryable ? (
                          <div className={styles.nativeShareContainer}>
                            <IconButtonWithLabel
                              iconClass={styles.iconShare}
                              label="Send"
                              onClick={handleOnShareClass}
                            />
                          </div>
                        ) : (
                          <></>
                        )
                      }
                    />
                  </div>
                </div>
              );
            }}
          />
        </SlideInModal>
      );

      const doRequestClose = () => requestClose.get()();
      running.callbacks.add(doRequestClose);

      if (!running.get()) {
        running.callbacks.remove(doRequestClose);
        removeModal();
        return;
      }

      try {
        await onModalClosed;
      } finally {
        running.callbacks.remove(doRequestClose);
        removeModal();

        if (recentlyCopiedTimeout !== null) {
          clearTimeout(recentlyCopiedTimeout);
          recentlyCopiedTimeout = null;
        }
      }
    }

    async function openShareModal(link: string): Promise<void> {
      const unknownWindow = window as any;
      if (typeof unknownWindow !== 'object' || unknownWindow === null) {
        return;
      }

      if (
        !('navigator' in unknownWindow) ||
        typeof unknownWindow.navigator !== 'object' ||
        unknownWindow.navigator === null ||
        !('share' in unknownWindow.navigator)
      ) {
        console.log('detected no support for navigator.share, using fallback');
        return openShareModalFallback(link, false);
      }

      if ('featurePolicy' in document) {
        const featurePolicy = (document as any).featurePolicy;
        if (
          featurePolicy &&
          typeof featurePolicy.features === 'function' &&
          typeof featurePolicy.allowsFeature === 'function'
        ) {
          try {
            const features = featurePolicy.features();
            if (
              typeof features === 'object' &&
              features !== null &&
              typeof features.includes === 'function' &&
              features.includes('web-share')
            ) {
              if (!featurePolicy.allowsFeature('web-share')) {
                console.log('detected explicit feature policy blocking web-share, using fallback');
                return openShareModalFallback(link, false);
              }
            }
          } catch (e) {}
        }
      }

      if (
        'userActivation' in unknownWindow.navigator &&
        typeof unknownWindow.navigator.userActivation === 'object' &&
        unknownWindow.navigator.userActivation !== null &&
        'isActive' in unknownWindow.navigator.userActivation &&
        !unknownWindow.navigator.userActivation.isActive
      ) {
        console.log('detected missed user activation window, using fallback');
        return openShareModalFallback(link, true);
      }

      if (localStorage.getItem('disable-native-share') === 'true') {
        console.log('native share disabled via local storage, using fallback');
        return openShareModalFallback(link, false);
      }

      try {
        console.log('trying native share to share link:', link);
        await window.navigator.share({
          url: link,
        });
      } catch (e) {
        let message: string | undefined = undefined;
        if (e instanceof Error) {
          message = e.message;
        } else if (
          typeof e === 'object' &&
          e !== null &&
          'message' in e &&
          typeof (e as any).message === 'string'
        ) {
          message = (e as any).message;
        }

        if (message === 'AbortError') {
          console.log('Seems like navigator share succeeded but user aborted, not using fallback');
          return;
        }

        if (message === 'DataError') {
          console.log('Detected no support for url-only sharing, using fallback');
          localStorage.setItem('disable-native-share', 'true');
          return openShareModalFallback(link, false);
        }

        if (message === 'NotAllowedError') {
          console.log(
            'Detected blocked by permissions policy or lack of transient activation, using fallback'
          );
          return openShareModalFallback(link, false);
        }

        console.log('Share failed for unknown reason, using fallback (message:', message, ')');
        return openShareModalFallback(link, false);
      }
    }

    async function getShareLink(journeyUid: string): Promise<string> {
      const lastLinkValue = lastLink.get();
      if (lastLinkValue !== null && lastLinkValue.uid === journeyUid) {
        return lastLinkValue.link;
      }

      const controller = window.AbortController ? new window.AbortController() : undefined;
      const signal = controller ? controller.signal : undefined;
      const doAbort = () => controller?.abort();
      running.callbacks.add(doAbort);
      if (!running.get()) {
        running.callbacks.remove(doAbort);
        throw new Error('canceled');
      }

      let response: Response;
      try {
        response = await apiFetch(
          '/api/1/journeys/create_share_link',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ uid: journeyUid }),
            signal,
          },
          loginContext
        );
      } finally {
        running.callbacks.remove(doAbort);
      }

      if (!response.ok) {
        if (
          (response.status === 404 || response.status === 409) &&
          running.get() &&
          journeyVWC.get().uid === journeyUid
        ) {
          setVWC(shareable, false);
        }

        throw response;
      }

      const body = await response.json();
      return body.url;
    }

    async function handleShareInner(journeyUid: string) {
      const link = await getShareLink(journeyUid);
      if (!running.get()) {
        return;
      }

      setVWC(lastLink, { uid: journeyUid, link });
      await openShareModal(link);
    }

    async function handleShare(journeyUid: string) {
      try {
        await handleShareInner(journeyUid);
      } catch (e) {
        const err = await describeError(e);
        if (running.get()) {
          setVWC(error, err);
        }
      } finally {
        setVWC(working, false);
      }
    }
  }, [error, journeyVWC, lastLink, loginContextRaw.value, modalContext.modals, shareable, working]);

  return useMemo(
    () => ({ working, shareClass, error, shareable }),
    [working, error, shareClass, shareable]
  );
};
