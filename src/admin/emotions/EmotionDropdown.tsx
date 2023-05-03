import { ReactElement, useCallback } from 'react';
import { CrudFetcherSort } from '../crud/CrudFetcher';
import { Emotion } from './Emotion';
import { CrudDropdown } from '../crud/CrudDropdown';

type EmotionWithUidAlias = {
  uid: string;
  word: string;
};

type EmotionDropdownProps = {
  /**
   * Called in response to the user selecting an item.
   * @param item The item selected
   */
  setSelected: (this: void, item: Emotion | null) => void;

  /**
   * If specified, called to filter the items on the client side. If this
   * returns true, the emotion is kept, otherwise it is filtered out.
   *
   * @param item The item to filter
   * @returns True if the item should be kept, false to discard.
   */
  localFilter?: (this: void, item: Emotion) => boolean;
};

/**
 * The sort for the emotion crud dropdown
 */
const emotionSort: CrudFetcherSort = [{ key: 'word', dir: 'asc', before: null, after: null }];

const makeEmotionComponent = (emotion: Emotion): ReactElement => {
  return <>{emotion.word}</>;
};

/**
 * Shows a crud dropdown component for selecting emotions. When using the
 * crud dropdown directly, it's easy to accidentally cause unnecessary
 * server requests.
 */
export const EmotionDropdown = ({
  setSelected,
  localFilter,
}: EmotionDropdownProps): ReactElement => {
  const wrappedSetSelected = useCallback(
    (wrapped: EmotionWithUidAlias | null) => {
      if (wrapped === null) {
        setSelected(null);
      } else {
        setSelected({ word: wrapped.word });
      }
    },
    [setSelected]
  );

  return (
    <CrudDropdown
      path="/api/1/emotions/search"
      keyMap={(raw: Emotion) => ({ uid: raw.word, word: raw.word })}
      sort={emotionSort}
      component={makeEmotionComponent}
      setSelected={wrappedSetSelected}
      localFilter={localFilter}
    />
  );
};
