import { useMemo, useRef } from 'react';
import { InfiniteListing, NetworkedInfiniteListing } from '../../../shared/lib/InfiniteListing';
import { LoginContextValue } from '../../../shared/contexts/LoginContext';
import { VariableStrategyProps } from '../../../shared/anim/VariableStrategyProps';
import { ExternalCourse, externalCourseKeyMap } from '../lib/ExternalCourse';

/**
 * Returns an infinite list, which is reset upon creation, for the series
 * on the series tab
 *
 * @param loginContext The login context to use to authorize requests
 * @param visibleHeight The amount of visible height the list will take up,
 *   used to configure the listing.
 * @returns The infinite list
 */
export const useSeriesTabList = (
  loginContextRaw: LoginContextValue,
  visibleHeight: VariableStrategyProps<number>
): InfiniteListing<ExternalCourse> => {
  // We don't want to reload the listing due to height changing as that's pretty annoying.
  // so for now we just use whatever initial value it has
  const numVisibleRef = useRef(
    Math.max(
      Math.ceil(
        (visibleHeight.type === 'react-rerender' ? visibleHeight.props : visibleHeight.props()) /
          427
      ),
      3
    ) * 5
  );
  return useMemo<InfiniteListing<ExternalCourse>>(() => {
    const numVisible = numVisibleRef.current;
    const result = new NetworkedInfiniteListing<ExternalCourse>(
      '/api/1/courses/search_public?category=list',
      Math.min(numVisible * 2 + 10, 50),
      numVisible,
      10,
      {},
      [
        {
          key: 'created_at',
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
            key: 'created_at',
            dir: dir === 'before' ? 'asc' : 'desc',
            before: null,
            after: item.createdAt === null ? null : item.createdAt.getTime() / 1000,
          },
          {
            key: 'uid',
            dir: dir === 'before' ? 'desc' : 'asc',
            before: null,
            after: item.uid,
          },
        ];
      },
      externalCourseKeyMap,
      loginContextRaw
    );
    result.reset();
    return result;
  }, [loginContextRaw]);
};
