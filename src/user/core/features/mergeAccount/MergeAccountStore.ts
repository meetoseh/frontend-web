import { MergeSuggestion } from './MergeAccountState';

/**
 * The state that the merge account feature persists locally
 */
export type MergeAccountStoredState = {
  /**
   * The sub of the user for which we fetched merge suggestions
   */
  userSub: string;
  /**
   * The merge suggestions from the server, where a list is always
   * non-empty and no suggestions is indicated by null.
   */
  mergeSuggestions: MergeSuggestion[] | null;
  /**
   * The date at which we got the merge suggestions from the server
   */
  checkedAt: Date;
};

const mergeAccountLocalStorageKey = 'merge-account';

/**
 * Retrieves the currently stored merge account stored state, if there is any
 * any it is valid, otherwise null. This does not check for expiration.
 */
export const getMergeAccountStoredState = async (): Promise<MergeAccountStoredState | null> => {
  const raw = localStorage.getItem(mergeAccountLocalStorageKey);
  if (raw === null) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse merge account stored state', e);
    localStorage.removeItem(mergeAccountLocalStorageKey);
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    console.error('Invalid merge account stored state', parsed);
    localStorage.removeItem(mergeAccountLocalStorageKey);
    return null;
  }

  if (typeof parsed.userSub !== 'string') {
    console.error('Invalid merge account stored state', parsed);
    localStorage.removeItem(mergeAccountLocalStorageKey);
    return null;
  }

  if (!Array.isArray(parsed.mergeSuggestions) && parsed.mergeSuggestions !== null) {
    console.error('Invalid merge account stored state', parsed);
    localStorage.removeItem(mergeAccountLocalStorageKey);
    return null;
  }

  if (typeof parsed.checkedAt !== 'number') {
    console.error('Invalid merge account stored state', parsed);
    localStorage.removeItem(mergeAccountLocalStorageKey);
    return null;
  }

  return {
    userSub: parsed.userSub,
    mergeSuggestions: parsed.mergeSuggestions,
    checkedAt: new Date(parsed.checkedAt),
  };
};

/**
 * Stores the given merge account stored state, or removes it if null is given.
 * This does not check for expiration.
 */
export const setMergeAccountStoredState = async (
  state: MergeAccountStoredState | null
): Promise<void> => {
  if (state === null) {
    localStorage.removeItem(mergeAccountLocalStorageKey);
    return;
  }

  const raw = JSON.stringify({
    userSub: state.userSub,
    mergeSuggestions: state.mergeSuggestions,
    checkedAt: state.checkedAt.getTime(),
  });
  localStorage.setItem(mergeAccountLocalStorageKey, raw);
};
