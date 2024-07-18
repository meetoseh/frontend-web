import { ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { SimpleHomeMappedParams } from './SimpleHomeParams';
import { SimpleHomeResources } from './SimpleHomeResources';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridImageBackground } from '../../../../shared/components/GridImageBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import styles from './SimpleHome.module.css';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { IconButton } from '../../../../shared/forms/IconButton';
import { RoundMenu } from './icons/RoundMenu';
import { screenOut } from '../../lib/screenOut';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { FavoritesShortcut } from './icons/FavoritesShortcut';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { GoalPill } from '../home/components/GoalPill';
import { Button } from '../../../../shared/forms/Button';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import { OpacityTransitionOverlay } from '../../../../shared/components/OpacityTransitionOverlay';

/**
 * The version of the home screen with the home copy and goal pill in
 * the center. At the bottom is one or two call to actions, and the top
 * has some simple shortcuts to settings or favorites.
 */
export const SimpleHome = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<
  'simple_home',
  SimpleHomeResources,
  SimpleHomeMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridImageBackground image={resources.image} thumbhash={resources.imageThumbhash} />
      <OpacityTransitionOverlay opacity={transitionState.opacity} />
      <GridContentContainer
        contentWidthVWC={ctx.contentWidth}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start"
        left={transitionState.left}
        opacity={transitionState.opacity}>
        <VerticalSpacer height={8} />
        <div className={styles.header}>
          <IconButton
            icon={<RoundMenu />}
            srOnlyName="Navigation"
            onClick={(e) => {
              e.preventDefault();
              trace({ type: 'nav' });
              screenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.settings.exit,
                screen.parameters.settings.trigger
              );
            }}
          />
          <HorizontalSpacer width={0} flexGrow={1} />
          <IconButton
            icon={<FavoritesShortcut />}
            srOnlyName="Favorites"
            onClick={(e) => {
              e.preventDefault();
              trace({ type: 'favorites' });
              screenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.favorites.exit,
                screen.parameters.favorites.trigger
              );
            }}
          />
        </div>
        <VerticalSpacer height={0} flexGrow={1} />
        <RenderGuardedComponent
          props={resources.copy}
          component={(copy) => <div className={styles.headline}>{copy?.headline}</div>}
        />
        <VerticalSpacer height={0} maxHeight={24} flexGrow={3} />
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
        <VerticalSpacer height={0} maxHeight={48} flexGrow={3} />
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
        <VerticalSpacer height={0} flexGrow={1} />
        <Button
          type="button"
          variant="filled-white"
          onClick={(e) => {
            e.preventDefault();
            trace({ type: 'cta' });
            screenOut(
              workingVWC,
              startPop,
              transition,
              screen.parameters.cta.exit,
              screen.parameters.cta.trigger
            );
          }}>
          {screen.parameters.cta.text}
        </Button>
        {screen.parameters.cta2 !== null && (
          <>
            <VerticalSpacer height={0} maxHeight={12} flexGrow={3} />
            <Button
              type="button"
              variant="link-white"
              onClick={(e) => {
                e.preventDefault();
                const cta2 = screen.parameters.cta2;
                if (cta2 === null) {
                  return;
                }
                trace({ type: 'cta2' });
                screenOut(workingVWC, startPop, transition, cta2.exit, cta2.trigger);
              }}>
              {screen.parameters.cta2.text}
            </Button>
          </>
        )}
        <VerticalSpacer height={56} />
      </GridContentContainer>
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};
