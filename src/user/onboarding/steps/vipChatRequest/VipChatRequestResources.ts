import { OsehImageState } from '../../../../shared/OsehImage';

/**
 * The resources for the phone-04102023 variant of this prompt
 */
export type Phone04102023VariantResources = {
  /**
   * The background image
   */
  background: OsehImageState;

  /**
   * The foreground image
   */
  image: OsehImageState;
};

/**
 * The resources required to render the vip chat request prompt.
 */
export type VipChatRequestResources = {
  /**
   * The variant resources, or null if the variant resources are
   * unavailable
   */
  variant: Phone04102023VariantResources | null;

  /**
   * The window size to render at
   */
  windowSize: { width: number; height: number };

  /**
   * True if this is still loading more resources, false if the component
   * is ready to be mounted
   */
  loading: boolean;
};
