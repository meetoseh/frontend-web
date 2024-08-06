import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './ImageInterstitial.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { ImageInterstitialResources } from './ImageInterstitialResources';
import { ImageInterstitialMappedParams } from './ImageInterstitialParams';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { configurableScreenOut } from '../../lib/configurableScreenOut';

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
          <VerticalSpacer height={32} />
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
          <VerticalSpacer height={32} />
          <div className={styles.header}>{screen.parameters.header}</div>
          <VerticalSpacer height={16} />
          <div className={styles.message}>{screen.parameters.message}</div>
        </div>
        <div className={styles.bottom}>
          <Button
            type="button"
            variant="filled-white"
            onClick={async (e) => {
              e.preventDefault();
              configurableScreenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.exit,
                screen.parameters.trigger
              );
            }}>
            {screen.parameters.cta}
          </Button>
          <VerticalSpacer height={32} />
        </div>
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
