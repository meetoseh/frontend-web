import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { InteractivePrompt } from './InteractivePrompt';
import { Stats } from '../hooks/useStats';

export type PromptSettings<P extends InteractivePrompt, R> = {
  /**
   * Gets the response value from the prompt and the index of the response
   *
   * @param prompt The interactive prompt
   * @param index The selected index, or null if nothing is selected
   * @returns The response value
   */
  getSelectionFromIndex: (prompt: P, index: number | null) => R;

  /**
   * Gets the response distribution from the prompt and stats; use a
   * sensible default if the stats are invalid, based on the prompt.
   * The length of the response should only depend on the prompt.
   *
   * @param prompt The interactive prompt
   * @param stats The stats
   * @returns The response distribution as the number of people who have chosen each response
   */
  getResponseDistributionFromStats: (prompt: P, stats: Stats) => number[];

  /**
   * Makes the network request to store that the user made the given response. This should
   * return a rejected promise if anything prevents the response from being stored.
   *
   * @param loginContext The user who made the response
   * @param prompt The interactive prompt
   * @param time The time at which the response was made
   * @param response The response value
   * @param index The index of the response
   * @returns A promise which resolves when the response is stored successfully
   */
  storeResponse: (
    loginContext: LoginContextValue,
    prompt: P,
    time: number,
    response: R,
    index: number | null
  ) => Promise<void>;
};
