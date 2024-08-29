import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridImageBackground } from '../../../../shared/components/GridImageBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import styles from './HomeV4.module.css';
import assistiveStyles from '../../../../shared/assistive.module.css';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { IconButton } from '../../../../shared/forms/IconButton';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { OpacityTransitionOverlay } from '../../../../shared/components/OpacityTransitionOverlay';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ContentContainer } from '../../../../shared/components/ContentContainer';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { RoundMenu } from '../../../../shared/components/icons/RoundMenu';
import { OsehColors } from '../../../../shared/OsehColors';
import { HomeV4Resources } from './HomeV4Resources';
import { HomeV4MappedParams } from './HomeV4Params';
import { Play } from '../../../../shared/components/icons/Play';
import { HeartFilled } from '../../../../shared/components/icons/HeartFilled';
import { SendRight } from '../../../../shared/components/icons/SendRight';
import { GoalPill } from './components/GoalPillV4';

/**
 * Similiar to SimpleHome, but rearranged a bit. The version for iOS app version 4.2.1
 * aka v84.
 */
export const HomeV4 = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<'homev4', HomeV4Resources, HomeV4MappedParams>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);
  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (v) => v.width);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridImageBackground image={resources.image} thumbhash={resources.imageThumbhash} />
      <OpacityTransitionOverlay opacity={transitionState.opacity} />
      <GridContentContainer
        contentWidthVWC={windowWidthVWC}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start"
        left={transitionState.left}
        opacity={transitionState.opacity}>
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.row}>
            <IconButton
              icon={
                <RoundMenu
                  icon={{ width: 18 }}
                  container={{ width: 48 + 24, height: 48 + 8 }}
                  startPadding={{
                    x: { fixed: 0 },
                    y: { fixed: 8 + (48 - 12) / 2 },
                  }}
                  color={OsehColors.v4.primary.light}
                />
              }
              srOnlyName="Navigation"
              onClick={(e) => {
                e.preventDefault();
                configurableScreenOut(
                  workingVWC,
                  startPop,
                  transition,
                  screen.parameters.menu.exit,
                  screen.parameters.menu.trigger,
                  {
                    afterDone: () => {
                      trace({ type: 'menu' });
                    },
                  }
                );
              }}
            />
          </div>
        </ContentContainer>
        <VerticalSpacer height={0} flexGrow={1} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <RenderGuardedComponent
            props={resources.copy}
            component={(copy) => <div className={styles.headline}>{copy?.headline}</div>}
          />
        </ContentContainer>
        <VerticalSpacer height={0} maxHeight={24} flexGrow={3} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <RenderGuardedComponent
            props={resources.copy}
            component={(copy) => {
              if (copy === null || copy === undefined) {
                return <></>;
              }

              if (copy.subheadline.startsWith('“')) {
                const sep = '” —';
                const parts = copy.subheadline.split(sep);
                if (parts.length === 2) {
                  const quote = parts[0].slice(1);
                  const author = parts[1];
                  return (
                    <>
                      <div className={styles.subheadlineQuote}>{quote}</div>
                      <VerticalSpacer height={12} />
                      <div className={styles.subheadlineAuthor}>{author}</div>
                    </>
                  );
                }
              }

              return <div className={styles.subheadline}>{copy.subheadline}</div>;
            }}
          />
        </ContentContainer>
        <VerticalSpacer height={0} maxHeight={48} flexGrow={3} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.row}>
            <GoalPill
              streak={resources.streak}
              updateGoal={() => {
                configurableScreenOut(
                  workingVWC,
                  startPop,
                  transition,
                  screen.parameters.goal.exit,
                  screen.parameters.goal.trigger,
                  {
                    afterDone: () => {
                      trace({ type: 'goal' });
                    },
                  }
                );
              }}
            />
          </div>
        </ContentContainer>
        <VerticalSpacer height={0} flexGrow={1} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.row}>
            <div className={styles.bottomButtonWrapper}>
              <button
                type="button"
                className={styles.bottomButton}
                onClick={(e) => {
                  e.preventDefault();
                  configurableScreenOut(
                    workingVWC,
                    startPop,
                    transition,
                    screen.parameters.classes.exit,
                    screen.parameters.classes.trigger,
                    {
                      afterDone: () => {
                        trace({ type: 'classes' });
                      },
                    }
                  );
                }}>
                <div className={assistiveStyles.srOnly}>Classes</div>
                <Play
                  icon={{ width: 28 }}
                  container={{
                    width: 51,
                    height: 51,
                  }}
                  startPadding={{
                    x: { fixed: 9 },
                    y: { fraction: 0.5 },
                  }}
                  color={OsehColors.v4.primary.light}
                />
              </button>
            </div>
            <HorizontalSpacer width={0} maxWidth={24} flexGrow={1} />
            <div className={styles.bottomButtonWrapper}>
              <button
                type="button"
                className={styles.bottomButton}
                onClick={(e) => {
                  e.preventDefault();
                  configurableScreenOut(
                    workingVWC,
                    startPop,
                    transition,
                    screen.parameters.favorites.exit,
                    screen.parameters.favorites.trigger,
                    {
                      afterDone: () => {
                        trace({ type: 'favorites' });
                      },
                    }
                  );
                }}>
                <div className={assistiveStyles.srOnly}>Favorites</div>
                <HeartFilled
                  icon={{ width: 24 }}
                  container={{
                    width: 51,
                    height: 51,
                  }}
                  startPadding={{
                    x: { fraction: 0.5 },
                    y: { fraction: 0.5 },
                  }}
                  color={OsehColors.v4.primary.light}
                />
              </button>
            </div>
            <HorizontalSpacer width={0} maxWidth={24} flexGrow={1} />
            <div className={styles.checkinButtonWrapper}>
              <button
                type="button"
                className={styles.bottomButton}
                onClick={(e) => {
                  e.preventDefault();
                  configurableScreenOut(
                    workingVWC,
                    startPop,
                    transition,
                    screen.parameters.checkin.exit,
                    screen.parameters.checkin.trigger,
                    {
                      afterDone: () => {
                        trace({ type: 'checkin' });
                      },
                    }
                  );
                }}>
                <div className={styles.column}>
                  <VerticalSpacer height={12} />
                  <div className={styles.row}>
                    <HorizontalSpacer width={20} />
                    <div className={styles.checkinText}>{screen.parameters.checkin.text}</div>
                    <HorizontalSpacer width={0} flexGrow={1} />
                    <SendRight
                      icon={{ width: 24 }}
                      container={{
                        width: 26,
                        height: 26,
                      }}
                      startPadding={{
                        x: { fraction: 0.5 },
                        y: { fraction: 0.5 },
                      }}
                      color={OsehColors.v4.primary.light}
                      color2={OsehColors.v4.primary.dark}
                    />
                    <HorizontalSpacer width={20} />
                  </div>
                  <VerticalSpacer height={12} />
                </div>
              </button>
            </div>
          </div>
        </ContentContainer>
        <VerticalSpacer height={32} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
