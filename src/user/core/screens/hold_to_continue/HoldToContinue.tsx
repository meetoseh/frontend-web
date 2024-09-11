import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import {
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import {
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import { ScreenComponentProps } from '../../models/Screen';
import { HoldToContinueParamsParsed } from './HoldToContinueParams';
import { HoldToContinueResources } from './HoldToContinueResources';
import styles from './HoldToContinue.module.css';
import { CSSProperties, ReactElement, useEffect } from 'react';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';
import { useStyleVWC } from '../../../../shared/hooks/useStyleVWC';
import { setVWC } from '../../../../shared/lib/setVWC';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { screenWithWorking } from '../../lib/screenWithWorking';
import { waitForValueWithCallbacksConditionCancelable } from '../../../../shared/lib/waitForValueWithCallbacksCondition';
import { createCancelableTimeout } from '../../../../shared/lib/createCancelableTimeout';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { constructCancelablePromise } from '../../../../shared/lib/CancelablePromiseConstructor';
import { waitForAnimationFrameCancelable } from '../../../../shared/lib/waitForAnimationFrameCancelable';
import { CancelablePromise } from '../../../../shared/lib/CancelablePromise';
import { ease } from '../../../../shared/lib/Bezier';

/**
 * A more interesting version of a confirmation screen that has the user
 * hold a button for a certain amount of time before they can proceed. Includes
 * haptics and an animation while they are holding.
 */
export const HoldToContinue = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<
  'hold_to_continue',
  HoldToContinueResources,
  HoldToContinueParamsParsed
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);
  const imageContainerVWC = useWritableValueWithCallbacks<HTMLButtonElement | null>(() => null);
  const imageTranslationVWC = useWritableValueWithCallbacks(() => ({ x: 0, y: 0 }));
  const imageScaleVWC = useWritableValueWithCallbacks(() => 0.4);
  const imageContainerStyleVWC = useMappedValuesWithCallbacks(
    [imageTranslationVWC, imageScaleVWC],
    (): CSSProperties => ({
      transform: `scale(${imageScaleVWC.get()}) translate(${imageTranslationVWC.get().x}px, ${
        imageTranslationVWC.get().y
      }px)`,
    })
  );
  useStyleVWC(imageContainerVWC, imageContainerStyleVWC);

  const onContinue = () => {
    screenWithWorking(workingVWC, async () => {
      setVWC(imageTranslationVWC, { x: 0, y: 0 });
      setVWC(imageScaleVWC, 0.4);

      const finishPop = startPop(
        {
          slug: screen.parameters.trigger.type === 'flow' ? screen.parameters.trigger.flow : 'skip',
          parameters:
            screen.parameters.trigger.type === 'flow' ? screen.parameters.trigger.parameters : null,
        },
        screen.parameters.trigger.endpoint ?? undefined
      );

      const continueTimeMS = screen.parameters.continueVibration.reduce((a, b) => a + b, 0);
      setVWC(transition.animation, { type: 'fade', ms: continueTimeMS });
      const exitTransition = playExitTransition(transition);

      const startedAt = performance.now();
      const doneAt = startedAt + continueTimeMS;
      let now = startedAt;

      const vibrating =
        window &&
        window.navigator &&
        !!window.navigator.vibrate &&
        (!(window.navigator as any).userActivation ||
          (window.navigator as any).userActivation.hasBeenActive);

      if (vibrating) {
        try {
          window.navigator.vibrate(screen.parameters.continueVibration);
        } catch (e) {}
      }

      while (true) {
        if (now >= doneAt) {
          break;
        }

        const linearProgress = (now - startedAt) / continueTimeMS;
        const easedProgress = ease.y_x(linearProgress);
        setVWC(imageScaleVWC, 0.4 + 0.6 * easedProgress);
        now = await waitForAnimationFrameCancelable().promise;
      }

      if (vibrating) {
        try {
          window.navigator.vibrate(0);
        } catch (e) {}
      }

      await exitTransition.promise;
      finishPop();
    });
  };

  // web only accessibility override: if focusing the button + press enter, immediately onContinue
  useValueWithCallbacksEffect(imageContainerVWC, (imageContainerRaw) => {
    if (imageContainerRaw === null) {
      return undefined;
    }
    const imageContainer = imageContainerRaw;
    imageContainer.addEventListener('keydown', onKeyDown);
    return () => {
      imageContainer.removeEventListener('keydown', onKeyDown);
    };

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        trace({ type: 'accessibility-skip', step: 'enter' });
        onContinue();
      }
    }
  });

  // web only: detect button down via detecting :active state
  const buttonDownVWC = useWritableValueWithCallbacks(() => false);
  useValueWithCallbacksEffect(imageContainerVWC, (imageContainerRaw) => {
    if (imageContainerRaw === null) {
      return undefined;
    }
    const imageContainer = imageContainerRaw;
    imageContainer.addEventListener('pointerdown', setDown, { passive: true });
    imageContainer.addEventListener('pointerup', setUp, { passive: true });
    imageContainer.addEventListener('pointercancel', setUp, { passive: true });
    imageContainer.addEventListener('pointerleave', setUp, { passive: true });
    imageContainer.addEventListener('pointerenter', setUp, { passive: true });

    setUp();

    return () => {
      setVWC(buttonDownVWC, false);
      imageContainer.removeEventListener('pointerdown', setDown);
      imageContainer.removeEventListener('pointerup', setUp);
      imageContainer.removeEventListener('pointercancel', setUp);
      imageContainer.removeEventListener('pointerleave', setUp);
      imageContainer.removeEventListener('pointerenter', setUp);
    };

    function setDown() {
      setVWC(buttonDownVWC, true);
    }
    function setUp() {
      setVWC(buttonDownVWC, false);
    }
  });

  // web only: for chrome in device mode, suppress context menu on long press
  useEffect(() => {
    window.addEventListener('contextmenu', suppressContextMenu);
    return () => {
      window.removeEventListener('contextmenu', suppressContextMenu);
    };

    function suppressContextMenu(event: any) {
      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
    }
  });

  useEffect(() => {
    const activeVWC = createWritableValueWithCallbacks(true);
    handle();
    return () => {
      setVWC(activeVWC, false);
    };

    async function handle() {
      const notActive = waitForValueWithCallbacksConditionCancelable(activeVWC, (v) => !v);
      notActive.promise.catch(() => {});
      let working = waitForValueWithCallbacksConditionCancelable(workingVWC, (v) => v);
      working.promise.catch(() => {});
      try {
        while (true) {
          if (!activeVWC.get()) {
            return;
          }

          if (workingVWC.get() || working.done()) {
            const notWorking = waitForValueWithCallbacksConditionCancelable(workingVWC, (v) => !v);
            notWorking.promise.catch(() => {});
            await Promise.race([notWorking.promise, notActive.promise]);
            notWorking.cancel();
            working = waitForValueWithCallbacksConditionCancelable(workingVWC, (v) => v);
            working.promise.catch(() => {});
            continue;
          }

          setVWC(imageTranslationVWC, { x: 0, y: 0 });
          setVWC(imageScaleVWC, 0.4);

          if (window && window.navigator && window.navigator.vibrate) {
            if (
              !(window.navigator as any).userActivation ||
              (window.navigator as any).userActivation.hasBeenActive
            ) {
              try {
                window.navigator.vibrate(0);
              } catch (e) {}
            }
          }

          const buttonDown = waitForValueWithCallbacksConditionCancelable(buttonDownVWC, (v) => v);
          buttonDown.promise.catch(() => {});
          await Promise.race([buttonDown.promise, notActive.promise, working.promise]);
          buttonDown.cancel();

          if (!buttonDownVWC.get()) {
            continue;
          }
          trace({ type: 'hold', step: 'start' });

          if (screen.parameters.holdTimeMS > 0) {
            const holdFinished = createCancelableTimeout(screen.parameters.holdTimeMS);
            holdFinished.promise.catch(() => {});
            const buttonUp = waitForValueWithCallbacksConditionCancelable(buttonDownVWC, (v) => !v);
            buttonUp.promise.catch(() => {});
            const shaker = createCancelableShaker(imageTranslationVWC);
            shaker.promise.catch(() => {});
            if (window && window.navigator && window.navigator.vibrate) {
              if (
                !(window.navigator as any).userActivation ||
                (window.navigator as any).userActivation.hasBeenActive
              ) {
                try {
                  window.navigator.vibrate(screen.parameters.holdVibration);
                } catch (e) {}
              }
            }
            await Promise.race([
              holdFinished.promise,
              buttonUp.promise,
              notActive.promise,
              working.promise,
            ]);
            buttonUp.cancel();
            holdFinished.cancel();
            shaker.cancel();

            if (!activeVWC.get() || !buttonDownVWC.get() || working.done()) {
              trace({ type: 'hold', step: 'cancel' });
              continue;
            }
          }

          trace({ type: 'hold', step: 'complete' });
          onContinue();
          return;
        }
      } finally {
        notActive.cancel();
        working.cancel();
      }
    }
  });

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <VerticalSpacer height={0} flexGrow={2} />
        <button
          type="button"
          className={styles.image}
          ref={(r) => setVWC(imageContainerVWC, r)}
          style={imageContainerStyleVWC.get()}>
          <RenderGuardedComponent
            props={resources.image}
            component={(image) => (
              <OsehImageFromState
                loading={image === null}
                localUrl={image?.croppedUrl ?? null}
                displayWidth={200}
                displayHeight={200}
                alt=""
                thumbhash={screen.parameters.image.thumbhash}
                explicitNoDrag
              />
            )}
          />
        </button>
        <div className={styles.instructions}>{screen.parameters.instructions}</div>
        <VerticalSpacer height={16} flexGrow={1} />
        <div className={styles.title}>{screen.parameters.title}</div>
        <VerticalSpacer height={16} />
        <div className={styles.body}>{screen.parameters.body}</div>
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};

const createCancelableShaker = (
  translation: WritableValueWithCallbacks<{ x: number; y: number }>
): CancelablePromise<void> =>
  constructCancelablePromise({
    body: async (state, resolve, reject) => {
      const active = createWritableValueWithCallbacks(true);
      const onCancel = () => setVWC(active, false);
      state.cancelers.add(onCancel);
      if (state.finishing) {
        onCancel();
      }

      const canceled = waitForValueWithCallbacksConditionCancelable(active, (v) => !v);
      canceled.promise.catch(() => {});

      const cumulativeDrift: { x: number; y: number } = { x: 0, y: 0 };
      const driftSpeed = 0.1;
      try {
        let lastFrame = performance.now();
        let now = lastFrame;
        while (true) {
          if (!active.get()) {
            state.finishing = true;
            state.done = true;
            reject(new Error('canceled'));
            return;
          }

          const delta = now - lastFrame;
          let driftX =
            -cumulativeDrift.x * 0.1 * driftSpeed + (Math.random() * 2 - 1) * delta * driftSpeed;
          let driftY =
            -cumulativeDrift.y * 0.1 * driftSpeed + (Math.random() * 2 - 1) * delta * driftSpeed;

          if (driftX > 0 && cumulativeDrift.x + driftX > 20) {
            driftX = -driftX;
          } else if (driftX < 0 && cumulativeDrift.x + driftX < -20) {
            driftX = -driftX;
          }

          if (driftY > 0 && cumulativeDrift.y + driftY > 20) {
            driftY = -driftY;
          } else if (driftY < 0 && cumulativeDrift.y + driftY < -20) {
            driftY = -driftY;
          }

          const oldTranslation = translation.get();
          setVWC(
            translation,
            {
              x: oldTranslation.x + driftX,
              y: oldTranslation.y + driftY,
            },
            () => false
          );
          cumulativeDrift.x += driftX;
          cumulativeDrift.y += driftY;

          const nextFrame = waitForAnimationFrameCancelable();
          await Promise.race([canceled.promise, nextFrame.promise]);
          if (!active.get()) {
            nextFrame.cancel();
            continue;
          }

          lastFrame = now;
          now = await nextFrame.promise;
        }
      } finally {
        state.cancelers.remove(onCancel);
        canceled.cancel();
      }
    },
  });
