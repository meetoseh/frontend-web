import { MouseEventHandler, ReactElement } from 'react';
import styles from './ScreenHeader.module.css';
import { IconButton } from '../forms/IconButton';
import { Back } from './icons/Back';
import { OsehColors } from '../OsehColors';
import { RoundMenu } from './icons/RoundMenu';
import { HorizontalSpacer } from './HorizontalSpacer';
import { Close } from './icons/Close';
import { ValueWithCallbacks } from '../lib/Callbacks';
import { useMappedValuesWithCallbacks } from '../hooks/useMappedValuesWithCallbacks';
import { RenderGuardedComponent } from './RenderGuardedComponent';

export type ScreenHeaderProps = {
  /**
   * Configures the close button; null for no close button
   */
  close: {
    /** the variant to use for the icon and placement */
    variant: 'x' | 'back' | 'menu';
    /** handler for if the button is clicked */
    onClick: MouseEventHandler<HTMLButtonElement> | string;
  } | null;

  /**
   * The width of the window in pixels; used to avoid pseudo-aligning
   * (where stuff _almost_ aligns but not quite)
   */
  windowWidth: ValueWithCallbacks<number>;

  /**
   * The width of the content area in pixels; used to avoid pseudo-aligning
   * (where stuff _almost_ aligns but not quite)
   */
  contentWidth: ValueWithCallbacks<number>;

  /**
   * The header text to show
   */
  text: string;
};

/**
 * Shows a basic screen header that can be used for joining several relating
 * screens. Consists of a close button (if configured) and a header text.
 *
 * Generally, expected to be placed in a column-direction flex layout with align
 * items stretch.
 */
export const ScreenHeader = ({
  close,
  text,
  windowWidth,
  contentWidth,
}: ScreenHeaderProps): ReactElement => {
  const iconInfoVWC = useMappedValuesWithCallbacks([windowWidth, contentWidth], () => {
    const container = windowWidth.get();
    const inner = contentWidth.get();

    const iconReservedWidth = Math.min(Math.max(44, (container - 294) / 2), 100);

    const maximumPadding = iconReservedWidth - 20;
    const alignExactly = (container - inner) / 2;
    if (alignExactly < maximumPadding) {
      return { edge: alignExactly, reserve: iconReservedWidth };
    }
    return { edge: 24, reserve: iconReservedWidth };
  });

  return (
    <div className={styles.container}>
      {close?.variant === 'back' ? (
        <RenderGuardedComponent
          props={iconInfoVWC}
          component={({ edge, reserve }) => (
            <IconButton
              icon={
                <Back
                  icon={{ width: 20 }}
                  container={{ width: reserve, height: 53 }}
                  startPadding={{ x: { fixed: edge }, y: { fraction: 0.5 } }}
                  color={OsehColors.v4.primary.light}
                />
              }
              srOnlyName="Back"
              onClick={close.onClick}
            />
          )}
        />
      ) : close?.variant === 'menu' ? (
        <RenderGuardedComponent
          props={iconInfoVWC}
          component={({ edge, reserve }) => (
            <IconButton
              icon={
                <RoundMenu
                  icon={{ width: 18 }}
                  container={{ width: reserve, height: 53 }}
                  startPadding={{ x: { fixed: edge }, y: { fraction: 0.5 } }}
                  color={OsehColors.v4.primary.light}
                />
              }
              srOnlyName="Menu"
              onClick={close.onClick}
            />
          )}
        />
      ) : close !== null ? (
        <RenderGuardedComponent
          props={iconInfoVWC}
          component={({ reserve }) => <HorizontalSpacer width={reserve} />}
        />
      ) : undefined}
      <HorizontalSpacer width={0} flexGrow={1} />
      <div className={styles.text}>{text}</div>
      <HorizontalSpacer width={0} flexGrow={1} />
      {close?.variant === 'x' ? (
        <RenderGuardedComponent
          props={iconInfoVWC}
          component={({ edge, reserve }) => (
            <IconButton
              icon={
                <Close
                  icon={{ width: 20 }}
                  container={{ width: reserve, height: 53 }}
                  startPadding={{
                    x: { fixed: reserve - 20 - edge },
                    y: { fraction: 0.5 },
                  }}
                  color={OsehColors.v4.primary.light}
                />
              }
              srOnlyName="Close"
              onClick={close.onClick}
            />
          )}
        />
      ) : close !== null ? (
        <RenderGuardedComponent
          props={iconInfoVWC}
          component={({ reserve }) => <HorizontalSpacer width={reserve} />}
        />
      ) : undefined}
    </div>
  );
};
