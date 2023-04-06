import { OsehImageState } from '../../../../shared/OsehImage';
import { PublicInteractivePrompt } from '../../../../shared/hooks/usePublicInteractivePrompt';

/**
 * The resources required to render
 */
export type DailyGoalResources = {
  /**
   * The public interactive prompt to display, if it's been loaded,
   * null otherwise.
   */
  prompt: PublicInteractivePrompt | null;

  /**
   * The background to use, if it's been loaded, null otherwise.
   */
  background: OsehImageState | null;

  /**
   * True if we're still loading resources, false if we're ready to present.
   */
  loading: boolean;
};
