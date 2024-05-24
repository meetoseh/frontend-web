import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './ImageInterstitial.module.css';
import { Button } from '../../../../shared/forms/Button';
import {
  playExitTransition,
  useEntranceTransition,
  useTransitionProp,
} from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { setVWC } from '../../../../shared/lib/setVWC';
import { ImageInterstitialResources } from './ImageInterstitialResources';
import { ImageInterstitialMappedParams } from './ImageInterstitialParams';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';

/**
 * A basic image interstitial; top message, image, header, subheader, button with CTA
 */
export const ImageInterstitial = ({
  ctx,
  screen,
  resources,
  startPop,
}: ScreenComponentProps<
  'image_interstitial',
  ImageInterstitialResources,
  ImageInterstitialMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        left={transitionState.left}
        opacity={transitionState.opacity}
        justifyContent="space-between"
        gridSizeVWC={ctx.windowSizeImmediate}>
        <div className={styles.top}>
          <div style={{ height: '32px' }} />
          <div className={styles.topMessage}>{screen.parameters.top}</div>
        </div>
        <div className={styles.center}>
          <RenderGuardedComponent
            props={useMappedValuesWithCallbacks(
              [resources.image, resources.imageSizeImmediate],
              () => ({
                image: resources.image.get(),
                size: resources.imageSizeImmediate.get(),
              })
            )}
            component={({ image, size }) => (
              <OsehImageFromState
                loading={image.type !== 'success'}
                localUrl={image.type === 'success' ? image.data.croppedUrl : null}
                displayWidth={size.width}
                displayHeight={size.height}
                alt=""
                thumbhash={screen.parameters.image.thumbhash}
              />
            )}
          />
          <div style={{ height: '32px' }} />
          <div className={styles.header}>{screen.parameters.header}</div>
          <div style={{ height: '16px' }} />
          <div className={styles.message}>{screen.parameters.message}</div>
        </div>
        <div className={styles.bottom}>
          <Button
            type="button"
            variant="filled-white"
            onClick={async (e) => {
              e.preventDefault();
              if (workingVWC.get()) {
                return;
              }

              setVWC(workingVWC, true);
              const finishPop = startPop(
                screen.parameters.trigger === null
                  ? null
                  : {
                      slug: screen.parameters.trigger,
                      parameters: {},
                    }
              );
              setVWC(transition.animation, screen.parameters.exit);
              await playExitTransition(transition).promise;
              finishPop();
            }}>
            {screen.parameters.cta}
          </Button>
          <div style={{ height: '32px' }} />
        </div>
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
