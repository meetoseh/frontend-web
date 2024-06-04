import { ReactElement, useCallback, useContext } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import {
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { GridImageBackground } from '../../../../shared/components/GridImageBackground';
import { JourneyFeedbackResources } from './JourneyFeedbackResources';
import { JourneyFeedbackMappedParams } from './JourneyFeedbackParams';
import styles from './JourneyFeedback.module.css';
import shareStyles from '../../../journey/hooks/useShareClass.module.css';
import { JourneyFeedback as JourneyFeedbackComponent } from '../../../journey/components/JourneyFeedback';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import {
  base64URLToByteArray,
  computeAverageRGBAUsingThumbhash,
} from '../../../../shared/lib/colorUtils';
import { IconButtonWithLabel } from '../../../../shared/forms/IconButtonWithLabel';
import { Share } from './icons/Share';
import { EmptyHeartIcon } from '../series_details/icons/EmptyHeartIcon';
import { Button } from '../../../../shared/forms/Button';
import { useErrorModal } from '../../../../shared/hooks/useErrorModal';
import {
  ModalContext,
  addModalWithCallbackToRemove,
} from '../../../../shared/contexts/ModalContext';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../shared/lib/waitForValueWithCallbacksCondition';
import { SlideInModal } from '../../../../shared/components/SlideInModal';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { FullHeartIcon } from '../series_details/icons/FullHeartIcon';
import { createValueWithCallbacksEffect } from '../../../../shared/hooks/createValueWithCallbacksEffect';
import { useFavoritedModal } from '../../../favorites/hooks/useFavoritedModal';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { useUnfavoritedModal } from '../../../favorites/hooks/useUnfavoritedModal';
import { trackFavoritesChanged } from '../home/lib/trackFavoritesChanged';
import { screenOut } from '../../lib/screenOut';
import { storeResponse } from './lib/storeResponse';
import { makePrettyResponse } from './lib/makePrettyResponse';

/**
 * Allows the user to provide feedback on a journey
 */
export const JourneyFeedback = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<
  'journey_feedback',
  JourneyFeedbackResources,
  JourneyFeedbackMappedParams
>): ReactElement => {
  const modalContext = useContext(ModalContext);
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const backgroundAverageRGBVWC = useMappedValueWithCallbacks(
    resources.background.thumbhash,
    (th): [number, number, number] => {
      if (th === null) {
        return [0, 0, 0];
      }
      const rgba = computeAverageRGBAUsingThumbhash(base64URLToByteArray(th));
      return [rgba[0], rgba[1], rgba[2]];
    }
  );

  const transitionState = useStandardTransitionsState(transition);
  const workingVWC = useWritableValueWithCallbacks(() => false);

  const responseVWC = useWritableValueWithCallbacks<number | null>(() => null);
  const feedbackErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, feedbackErrorVWC, 'saving feedback');

  const shareErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  useErrorModal(modalContext.modals, shareErrorVWC, 'sharing journey');

  const storeResponseWrapper = useCallback((): Promise<boolean> => {
    return storeResponse({
      responseVWC,
      trace,
      ctx,
      feedbackErrorVWC,
      journey: screen.parameters.journey,
    });
  }, [responseVWC, trace, ctx, feedbackErrorVWC, screen.parameters.journey]);

  const tracedResponse = useWritableValueWithCallbacks<number | null>(() => null);
  useValueWithCallbacksEffect(responseVWC, (response) => {
    if (response === tracedResponse.get()) {
      return undefined;
    }

    trace({ type: 'changed', response, prettyResponse: makePrettyResponse(response) });
    setVWC(tracedResponse, response);
    return undefined;
  });

  const openShareModalFallback = useCallback(
    async (link: string, retryableInitial: boolean): Promise<void> => {
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
                    shareStyles.container,
                    isDisabled ? shareStyles.disablePointerEvents : undefined
                  )}>
                  <div className={shareStyles.content}>
                    <div className={shareStyles.copyContainer}>
                      <div className={shareStyles.title}>Use the following link:</div>
                      <div className={shareStyles.linkContainer}>
                        <RenderGuardedComponent
                          props={copyFailed}
                          component={(failed) => {
                            if (failed) {
                              // if copying failed, use a simpler dom in case we're making
                              // it harder for them to copy
                              return <div className={shareStyles.link}>{link}</div>;
                            }

                            return (
                              <button
                                type="button"
                                onClick={tryCopyLink}
                                disabled={isDisabled}
                                className={shareStyles.link}>
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
                          <div className={shareStyles.nativeShareContainer}>
                            <IconButtonWithLabel
                              iconClass={shareStyles.iconShare}
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

      try {
        await onModalClosed;
      } finally {
        removeModal();

        if (recentlyCopiedTimeout !== null) {
          clearTimeout(recentlyCopiedTimeout);
          recentlyCopiedTimeout = null;
        }
      }
    },
    [modalContext.modals]
  );

  const openShareModal = useCallback(
    async (link: string): Promise<void> => {
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
    },
    [openShareModalFallback]
  );

  const likeErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const showFavoritedUntilVWC = useWritableValueWithCallbacks<number | undefined>(() => undefined);
  const showUnfavoritedUntilVWC = useWritableValueWithCallbacks<number | undefined>(
    () => undefined
  );
  useValueWithCallbacksEffect(resources.likeState, (likeState) => {
    if (likeState === null) {
      setVWC(likeErrorVWC, null);
      setVWC(showFavoritedUntilVWC, undefined);
      setVWC(showUnfavoritedUntilVWC, undefined);
      return undefined;
    }

    const cleanupError = createValueWithCallbacksEffect(likeState.error, (e) => {
      setVWC(likeErrorVWC, e);
      return undefined;
    });

    const cleanupFavorited = createValueWithCallbacksEffect(likeState.showLikedUntil, (u) => {
      setVWC(showFavoritedUntilVWC, u);
      return undefined;
    });

    const cleanupUnfavorited = createValueWithCallbacksEffect(likeState.showUnlikedUntil, (u) => {
      setVWC(showUnfavoritedUntilVWC, u);
      return undefined;
    });

    return () => {
      cleanupError();
      cleanupFavorited();
      cleanupUnfavorited();
    };
  });

  useErrorModal(modalContext.modals, likeErrorVWC, 'favoriting or unfavoriting journey');
  useFavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showFavoritedUntilVWC));
  useUnfavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showUnfavoritedUntilVWC));

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridImageBackground
        image={resources.background.image}
        thumbhash={resources.background.thumbhash}
      />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}>
        <GridFullscreenContainer windowSizeImmediate={resources.share.sizeImmediate}>
          <GridImageBackground
            image={resources.share.image}
            thumbhash={resources.share.thumbhash}
            borderRadius={10}
          />
          <GridContentContainer
            contentWidthVWC={ctx.contentWidth}
            gridSizeVWC={resources.share.sizeImmediate}
            justifyContent="space-between">
            <div className={styles.shareHeader}>
              <div className={styles.shareTitle}>{screen.parameters.journey.title}</div>
              <div className={styles.shareInstructor}>
                {screen.parameters.journey.instructor.name}
              </div>
            </div>
            <div className={styles.shareActions}>
              <RenderGuardedComponent
                props={resources.isShareable}
                component={(v) =>
                  !v?.shareable ? (
                    <></>
                  ) : (
                    <IconButtonWithLabel
                      iconClass={<Share />}
                      label="Share Class"
                      averageBackgroundColor={backgroundAverageRGBVWC}
                      onClick={async (e) => {
                        e.preventDefault();
                        trace({ type: 'share-start' });
                        const link = ctx.resources.journeyShareLinkHandler.request({
                          ref: { uid: screen.parameters.journey.uid },
                          refreshRef: () => {
                            throw new Error('not implemented');
                          },
                        });
                        const linkData = await waitForValueWithCallbacksConditionCancelable(
                          link.data,
                          (d) => d.type !== 'loading'
                        ).promise;
                        if (linkData.type === 'error') {
                          link.release();
                          trace({ type: 'share-error', dataType: linkData.type });
                          setVWC(shareErrorVWC, linkData.error);
                          return;
                        }
                        if (linkData.type !== 'success') {
                          link.release();
                          trace({ type: 'share-error', dataType: linkData.type });
                          setVWC(
                            shareErrorVWC,
                            <>failed to load (expected success, got {linkData.type})</>
                          );
                          return;
                        }
                        const url = linkData.data.link;
                        if (url === null) {
                          link.release();
                          trace({
                            type: 'share-error',
                            dataType: 'success',
                            reason: 'url is null (not shareable)',
                          });
                          setVWC(shareErrorVWC, <>This journey cannot be shared at this time</>);
                          return;
                        }

                        trace({ type: 'share-link', url });
                        try {
                          await openShareModal(url);
                        } finally {
                          link.release();
                        }
                      }}
                    />
                  )
                }
              />
              <RenderGuardedComponent
                props={resources.likeState}
                component={(v) =>
                  v === null ? (
                    <></>
                  ) : (
                    <IconButtonWithLabel
                      iconClass={
                        <RenderGuardedComponent
                          props={v.likedAt}
                          component={(likedAt) =>
                            likedAt === null ? <EmptyHeartIcon /> : <FullHeartIcon />
                          }
                        />
                      }
                      label="Favorite"
                      averageBackgroundColor={backgroundAverageRGBVWC}
                      onClick={async (e) => {
                        e.preventDefault();
                        v.toggleLike();
                        trackFavoritesChanged(ctx);
                      }}
                    />
                  )
                }
              />
            </div>
          </GridContentContainer>
        </GridFullscreenContainer>
        <div style={{ height: '32px' }} />
        <JourneyFeedbackComponent
          response={responseVWC}
          backgroundAverageRGB={backgroundAverageRGBVWC}
        />
        <div style={{ height: '32px' }} />
        <Button
          type="button"
          variant="filled-white"
          onClick={async (e) => {
            e.preventDefault();
            const cta = screen.parameters.cta1;
            screenOut(workingVWC, startPop, transition, cta.exit, cta.trigger, {
              beforeDone: async () => {
                await storeResponseWrapper();
              },
            });
          }}>
          {screen.parameters.cta1.text}
        </Button>
        {screen.parameters.cta2 !== null && (
          <>
            <div style={{ height: '16px' }} />
            <Button
              type="button"
              variant="outlined-white"
              onClick={async (e) => {
                e.preventDefault();
                const cta = screen.parameters.cta2;
                if (cta === null) {
                  setVWC(feedbackErrorVWC, <>cta2 is null but button handler called</>);
                  return;
                }
                screenOut(workingVWC, startPop, transition, cta.exit, cta.trigger, {
                  beforeDone: async () => {
                    await storeResponseWrapper();
                  },
                });
              }}>
              {screen.parameters.cta2.text}
            </Button>
          </>
        )}
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
