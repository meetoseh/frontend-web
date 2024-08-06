import { Fragment, ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { SimpleNavMappedParams } from './SimpleNavParams';
import { SimpleNavResources } from './SimpleNavResources';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { screenOut } from '../../lib/screenOut';
import styles from './SimpleNav.module.css';
import { TrackableAnchor } from '../../../../shared/components/TrackableAnchor';
import { IconButton } from '../../../../shared/forms/IconButton';
import { Close } from '../interactive_prompt_screen/icons/Close';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ContentContainer } from '../../../../shared/components/ContentContainer';
import { configurableScreenOut } from '../../lib/configurableScreenOut';

/**
 * A basic navigation screen with primary and secondary sections
 */
export const SimpleNav = ({
  ctx,
  screen,
  startPop,
  trace,
}: ScreenComponentProps<'simple_nav', SimpleNavResources, SimpleNavMappedParams>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={useMappedValueWithCallbacks(ctx.windowSizeImmediate, (v) => v.width)}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <div className={styles.close}>
          <IconButton
            icon={<Close />}
            srOnlyName="Close"
            onClick={(e) => {
              e.preventDefault();
              configurableScreenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.exit,
                screen.parameters.close,
                {
                  beforeDone: async () => {
                    trace({ type: 'close' });
                  },
                }
              );
            }}
          />
        </div>
        <VerticalSpacer height={0} flexGrow={1} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          {screen.parameters.primary.map((item, i) => (
            <Fragment key={`primary-${i}`}>
              {i !== 0 && <VerticalSpacer height={16} />}
              {item.type === 'trigger' && (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={(e) => {
                    e.preventDefault();
                    configurableScreenOut(
                      workingVWC,
                      startPop,
                      transition,
                      screen.parameters.exit,
                      item.trigger,
                      {
                        beforeDone: async () => {
                          trace({ type: 'primary', text: item.text, trigger: item.trigger });
                        },
                      }
                    );
                  }}>
                  {item.text}
                </button>
              )}
              {item.type === 'link' && (
                <TrackableAnchor
                  href={item.url}
                  className={styles.primary}
                  target="_blank"
                  rel="noreferrer"
                  onLinkClick={() => {
                    trace({ type: 'primary', text: item.text, url: item.url });
                  }}>
                  {item.text}
                </TrackableAnchor>
              )}
            </Fragment>
          ))}
        </ContentContainer>
        <VerticalSpacer height={0} flexGrow={5} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          {screen.parameters.secondary.map((item, i) => (
            <Fragment key={`secondary-${i}`}>
              {/* we put 4px padding on button to make easier to click */}
              {i !== 0 && <VerticalSpacer height={8} />}{' '}
              {item.type === 'trigger' && (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={(e) => {
                    e.preventDefault();
                    configurableScreenOut(
                      workingVWC,
                      startPop,
                      transition,
                      screen.parameters.exit,
                      item.trigger,
                      {
                        beforeDone: async () => {
                          trace({ type: 'secondary', text: item.text, trigger: item.trigger });
                        },
                      }
                    );
                  }}>
                  {item.text}
                </button>
              )}
              {item.type === 'link' && (
                <TrackableAnchor
                  href={item.url}
                  className={styles.secondary}
                  target="_blank"
                  rel="noreferrer"
                  onLinkClick={() => {
                    trace({ type: 'secondary', text: item.text, url: item.url });
                  }}>
                  {item.text}
                </TrackableAnchor>
              )}
            </Fragment>
          ))}
        </ContentContainer>
        <VerticalSpacer height={0} flexGrow={1} maxHeight={48} />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
