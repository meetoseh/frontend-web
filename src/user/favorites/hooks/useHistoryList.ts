import { useMemo, useRef } from 'react';
import { InfiniteListing, NetworkedInfiniteListing } from '../../../shared/lib/InfiniteListing';
import { MinimalJourney, minimalJourneyKeyMap } from '../lib/MinimalJourney';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { VariableStrategyProps } from '../../../shared/anim/VariableStrategyProps';

/**
 * Returns an infinite list, which is reset upon creation, for history
 * items.
 *
 * @param loginContext The login context to use to authorize requests
 * @param visibleHeight The amount of visible height the list will take up,
 *   used to configure the listing.
 * @returns The infinite list
 */
export const useHistoryList = (
  loginContextRaw: LoginContextValue,
  visibleHeight: VariableStrategyProps<number>
): InfiniteListing<MinimalJourney> => {
  // We don't want to reload the listing due to height changing as that's pretty annoying.
  // so for now we just use whatever initial value it has
  const numVisibleRef = useRef(
    Math.ceil(
      (visibleHeight.type === 'react-rerender' ? visibleHeight.props : visibleHeight.props()) / 85
    ) * 25
  );
  return useMemo<InfiniteListing<MinimalJourney>>(() => {
    const numVisible = numVisibleRef.current;
    const result = new NetworkedInfiniteListing<MinimalJourney>(
      '/api/1/users/me/search_history',
      Math.min(numVisible * 2 + 10, 150),
      numVisible,
      10,
      {},
      [
        {
          key: 'last_taken_at',
          dir: 'desc',
          before: null,
          after: null,
        },
        {
          key: 'uid',
          dir: 'asc',
          before: null,
          after: null,
        },
      ],
      (item, dir) => {
        return [
          {
            key: 'last_taken_at',
            dir: dir === 'before' ? 'asc' : 'desc',
            before: null,
            after: item.lastTakenAt === null ? null : item.lastTakenAt.getTime() / 1000,
          },
          {
            key: 'uid',
            dir: dir === 'before' ? 'desc' : 'asc',
            before: null,
            after: item.uid,
          },
        ];
      },
      minimalJourneyKeyMap,
      loginContextRaw
    );
    result.reset();
    return result;
  }, [loginContextRaw]);
};
