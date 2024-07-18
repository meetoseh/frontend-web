import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { HomeMappedParams } from './HomeParams';
import { HomeResources } from './HomeResources';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridBlackBackground } from '../../../../shared/components/GridBlackBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { GridImageBackground } from '../../../../shared/components/GridImageBackground';
import { BottomNavBar } from '../../../bottomNav/BottomNavBar';
import styles from './Home.module.css';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { GoalPill } from './components/GoalPill';
import { screenOut } from '../../lib/screenOut';
import { EmotionsPicker } from './components/EmotionsPicker';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';

/**
 * The version of the home screen with options to take a class by emotion, go to
 * settings, or view the available series. This screen can be a bit busy, so
 * `SimpleHome` is available as a simpler alternative.
 */
export const Home = ({
  ctx,
  screen,
  resources,
  startPop,
}: ScreenComponentProps<'home', HomeResources, HomeMappedParams>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);
  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (s) => s.width);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridBlackBackground />
      <GridContentContainer
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
        justifyContent="space-between"
        gridSizeVWC={ctx.windowSizeImmediate}>
        <GridFullscreenContainer windowSizeImmediate={resources.imageSizeImmediate}>
          <GridImageBackground image={resources.image} thumbhash={resources.imageThumbhash} />
          <GridContentContainer
            contentWidthVWC={ctx.contentWidth}
            gridSizeVWC={resources.imageSizeImmediate}
            justifyContent="space-around">
            <div style={{ flex: '3 0 0px' }} />
            <div className={styles.headerCopy}>
              <div className={styles.headerLine}>
                <RenderGuardedComponent
                  props={useMappedValueWithCallbacks(resources.copy, (c) => c?.headline)}
                  component={(header) => <div className={styles.header}>{header}</div>}
                />
                <RenderGuardedComponent
                  props={resources.profilePicture}
                  component={(picture) =>
                    picture === null ? (
                      <></>
                    ) : (
                      <img
                        width={32}
                        height={32}
                        src={picture.croppedUrl}
                        className={styles.profilePicture}
                        alt="Profile"
                      />
                    )
                  }
                />
              </div>
              <div style={{ height: '4px' }} />
              <RenderGuardedComponent
                props={useMappedValueWithCallbacks(resources.copy, (c) => c?.subheadline)}
                component={(subheader) => <div className={styles.subheader}>{subheader}</div>}
              />
            </div>
            <div style={{ flex: '1 0 0px' }} />
            <div className={styles.goal}>
              <GoalPill
                streak={resources.streak}
                updateGoal={() => {
                  screenOut(
                    workingVWC,
                    startPop,
                    transition,
                    screen.parameters.goal.exit,
                    screen.parameters.goal.trigger
                  );
                }}
              />
            </div>
            <div style={{ flex: '1 0 0px' }} />
          </GridContentContainer>
        </GridFullscreenContainer>
        <EmotionsPicker
          emotions={resources.emotions}
          onTapEmotion={(emotion) => {
            screenOut(
              workingVWC,
              startPop,
              transition,
              screen.parameters.emotion.exit,
              screen.parameters.emotion.trigger,
              {
                parameters: { emotion: emotion.word },
              }
            );
          }}
          expectedHeight={useMappedValuesWithCallbacks(
            [ctx.windowSizeImmediate, resources.imageSizeImmediate],
            () => {
              return (
                ctx.windowSizeImmediate.get().height -
                resources.imageSizeImmediate.get().height -
                67 /* bottom nav */
              );
            }
          )}
          contentWidth={windowWidthVWC}
          question="How do you want to feel today?"
        />
        <BottomNavBar
          active="home"
          clickHandlers={{
            series: () => {
              screenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.series.exit,
                screen.parameters.series.trigger
              );
            },
            account: () => {
              screenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.account.exit,
                screen.parameters.account.trigger
              );
            },
          }}
        />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
