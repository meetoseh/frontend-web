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
import { TransitionPropAsOwner } from '../lib/TransitionProp';
import { BottomNavBar } from '../../user/bottomNav/BottomNavBar';
import { ScreenStartPop } from '../../user/core/models/Screen';
import { VerticalSpacer } from './VerticalSpacer';
import { ScreenConfigurableTrigger } from '../../user/core/models/ScreenConfigurableTrigger';
import { configurableScreenOut } from '../../user/core/lib/configurableScreenOut';
import { OsehColors } from '../OsehColors';

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
  noTop,
}: {
  workingVWC: WritableValueWithCallbacks<boolean>;
  gridSize: ValueWithCallbacks<{ width: number; height: number }>;
  startPop: ScreenStartPop;
  trace: (event: any) => void;
  transitionState: StandardScreenTransitionState;
  transition: TransitionPropAsOwner<StandardScreenTransition['type'], StandardScreenTransition>;
  home:
    | {
        exit: StandardScreenTransition;
        trigger: ScreenConfigurableTrigger;
      }
    | (() => void)
    | null;
  series:
    | {
        exit: StandardScreenTransition;
        trigger: ScreenConfigurableTrigger;
      }
    | (() => void)
    | null;
  account:
    | {
        exit: StandardScreenTransition;
        trigger: ScreenConfigurableTrigger;
      }
    | (() => void)
    | null;
} & (
  | {
      back:
        | {
            exit: StandardScreenTransition;
            trigger: ScreenConfigurableTrigger;
          }
        | (() => void);
      title: string | ReactElement;
      noTop?: false;
    }
  | {
      back?: undefined;
      title?: undefined;
      noTop: true;
    }
)): ReactElement => (
  <GridContentContainer
    contentWidthVWC={useMappedValueWithCallbacks(gridSize, (s) => s.width)}
    left={transitionState.left}
    opacity={transitionState.opacity}
    gridSizeVWC={gridSize}
    justifyContent="flex-start"
    noPointerEvents>
    {!noTop ? (
      <div className={styles.header}>
        <div className={styles.backWrapper}>
          <IconButton
            icon={
              <Back
                icon={{ width: 20 }}
                container={{ width: 52, height: 53 }}
                startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                color={OsehColors.v4.primary.light}
              />
            }
            srOnlyName="Back"
            onClick={(e) => {
              e.preventDefault();

              if (typeof back === 'function') {
                back();
                return;
              }

              configurableScreenOut(workingVWC, startPop, transition, back.exit, back.trigger, {
                beforeDone: async () => {
                  trace({ type: 'back' });
                },
              });
            }}
          />
        </div>
        <div className={styles.headerText}>{title}</div>
      </div>
    ) : null}
    <VerticalSpacer height={0} flexGrow={1} />
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
                configurableScreenOut(workingVWC, startPop, transition, home.exit, home.trigger, {
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

                configurableScreenOut(
                  workingVWC,
                  startPop,
                  transition,
                  series.exit,
                  series.trigger,
                  {
                    beforeDone: async () => {
                      trace({ type: 'bottom-nav', key: 'series' });
                    },
                  }
                );
              },
        account:
          account === null
            ? undefined
            : () => {
                if (typeof account === 'function') {
                  account();
                  return;
                }
                configurableScreenOut(
                  workingVWC,
                  startPop,
                  transition,
                  account.exit,
                  account.trigger,
                  {
                    beforeDone: async () => {
                      trace({ type: 'bottom-nav', key: 'account' });
                    },
                  }
                );
              },
      }}
    />
  </GridContentContainer>
);
