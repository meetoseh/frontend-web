import { ReactElement } from 'react';
import { ValueWithCallbacks, WritableValueWithCallbacks } from '../lib/Callbacks';
import { GridContentContainer } from './GridContentContainer';
import {
  StandardScreenTransition,
  StandardScreenTransitionState,
} from '../hooks/useStandardTransitions';
import { useMappedValueWithCallbacks } from '../hooks/useMappedValueWithCallbacks';
import styles from './GridSimpleNavigationForeground.module.css';
import { IconButton } from '../forms/IconButton';
import { Back } from './icons/Back';
import { screenOut } from '../../user/core/lib/screenOut';
import { TransitionPropAsOwner } from '../lib/TransitionProp';
import { BottomNavBar } from '../../user/bottomNav/BottomNavBar';
import { ScreenStartPop } from '../../user/core/models/Screen';

export const GRID_SIMPLE_NAVIGATION_FOREGROUND_TOP_HEIGHT = 54;
export const GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT = 67;

/**
 * When placed on a grid, adds a top bar with a back button and a title, and a
 * bottom bar with navigation options. This is not expected to contain the
 * children in the middle; instead, it should be placed above another
 * GridContentContainer which is padded appropriately to give the illusion they
 * occupy the same layout space, using `GRID_SIMPLE_NAVIGATION_FOREGROUND_TOP_HEIGHT`
 * and `GRID_SIMPLE_NAVIGATION_FOREGROUND_BOTTOM_HEIGHT`.
 *
 * The main benefit to splitting like this is the navigation area wants to be full
 * width, but most content wants to be only the contentWidth, and nesting those
 * together is awkward compared to stacking.
 */
export const GridSimpleNavigationForeground = ({
  workingVWC,
  startPop,
  gridSize,
  transitionState,
  transition,
  trace,
  back,
  home,
  series,
  account,
  title,
}: {
  workingVWC: WritableValueWithCallbacks<boolean>;
  gridSize: ValueWithCallbacks<{ width: number; height: number }>;
  startPop: ScreenStartPop;
  trace: (event: any) => void;
  transitionState: StandardScreenTransitionState;
  transition: TransitionPropAsOwner<StandardScreenTransition['type'], StandardScreenTransition>;
  back:
    | {
        exit: StandardScreenTransition;
        trigger: string | null;
      }
    | (() => void);
  home:
    | {
        exit: StandardScreenTransition;
        trigger: string | null;
      }
    | (() => void)
    | null;
  series:
    | {
        exit: StandardScreenTransition;
        trigger: string | null;
      }
    | (() => void)
    | null;
  account:
    | {
        exit: StandardScreenTransition;
        trigger: string | null;
      }
    | (() => void)
    | null;
  title: string | ReactElement;
}): ReactElement => (
  <GridContentContainer
    contentWidthVWC={useMappedValueWithCallbacks(gridSize, (s) => s.width)}
    left={transitionState.left}
    opacity={transitionState.opacity}
    gridSizeVWC={gridSize}
    justifyContent="space-between"
    noPointerEvents>
    <div className={styles.header}>
      <div className={styles.backWrapper}>
        <IconButton
          icon={<Back />}
          srOnlyName="Back"
          onClick={(e) => {
            e.preventDefault();

            if (typeof back === 'function') {
              back();
              return;
            }

            screenOut(workingVWC, startPop, transition, back.exit, back.trigger, {
              beforeDone: async () => {
                trace({ type: 'back' });
              },
            });
          }}
        />
      </div>
      <div className={styles.headerText}>{title}</div>
    </div>
    <BottomNavBar
      active={
        home === null ? 'home' : series === null ? 'series' : account === null ? 'account' : 'home'
      }
      clickHandlers={{
        home:
          home === null
            ? undefined
            : () => {
                if (typeof home === 'function') {
                  home();
                  return;
                }
                screenOut(workingVWC, startPop, transition, home.exit, home.trigger, {
                  beforeDone: async () => {
                    trace({ type: 'bottom-nav', key: 'home' });
                  },
                });
              },
        series:
          series === null
            ? undefined
            : () => {
                if (typeof series === 'function') {
                  series();
                  return;
                }

                screenOut(workingVWC, startPop, transition, series.exit, series.trigger, {
                  beforeDone: async () => {
                    trace({ type: 'bottom-nav', key: 'series' });
                  },
                });
              },
        account:
          account === null
            ? undefined
            : () => {
                if (typeof account === 'function') {
                  account();
                  return;
                }
                screenOut(workingVWC, startPop, transition, account.exit, account.trigger, {
                  beforeDone: async () => {
                    trace({ type: 'bottom-nav', key: 'account' });
                  },
                });
              },
      }}
    />
  </GridContentContainer>
);
