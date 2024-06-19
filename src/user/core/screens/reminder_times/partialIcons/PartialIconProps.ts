import { ValueWithCallbacks } from '../../../../../shared/lib/Callbacks';

/**
 * The props to the dynamic icons within this folder. Describes what
 * can be animated
 */
export type PartialIconProps = {
  /**
   * The stroke color for the icon as an series of 0-1 values for
   * the fractional amount of red, green, blue, and alpha respectively
   */
  color: ValueWithCallbacks<[number, number, number, number]>;
};
