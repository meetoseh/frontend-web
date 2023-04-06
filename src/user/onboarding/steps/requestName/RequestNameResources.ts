import { OsehImageState } from '../../../../shared/OsehImage';

/**
 * The resources loaded for the request name component.
 */
export type RequestNameResources = {
  /**
   * The full-bleed background image
   */
  background: OsehImageState | null;

  /**
   * True if we're still loading resources, false if we're ready to present.
   */
  loading: boolean;
};
