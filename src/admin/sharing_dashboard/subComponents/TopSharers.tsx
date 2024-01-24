import { ReactElement } from 'react';
import { AdminDashboardLargeChartPlaceholder } from '../../dashboard/AdminDashboardLargeChartPlaceholder';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useTopSharers } from '../hooks/useTopSharers';
import { TopSharersCarousel } from './TopSharersCarousel';
import { TopSharerCarouselItem } from '../models/TopSharers';

export const TopSharers = (): ReactElement => {
  const topSharersAllTime = useTopSharers();
  const topSharersLast30Days = useTopSharers(30);

  const carouselItems = useMappedValuesWithCallbacks(
    [topSharersAllTime.result, topSharersLast30Days.result],
    () => {
      const allTimeResult = topSharersAllTime.result.get();
      const last30DaysResult = topSharersLast30Days.result.get();

      if (allTimeResult === undefined || last30DaysResult === undefined) {
        return undefined;
      }

      const result: TopSharerCarouselItem[] = [];
      let position = 0;
      while (true) {
        let didSomething = false;

        if (allTimeResult !== null && allTimeResult.topSharers.length > position) {
          didSomething = true;
          result.push({
            sharer: allTimeResult.topSharers[position],
            list: 'allTime',
            position,
          });
        }

        if (last30DaysResult !== null && last30DaysResult.topSharers.length > position) {
          didSomething = true;
          result.push({
            sharer: last30DaysResult.topSharers[position],
            list: 'last30Days',
            position,
          });
        }

        if (!didSomething) {
          return result;
        }

        position++;
      }
    }
  );

  return (
    <RenderGuardedComponent
      props={carouselItems}
      component={(items) => {
        if (items === undefined) {
          return (
            <AdminDashboardLargeChartPlaceholder placeholderText="Top (Recent) Sharers Carousel" />
          );
        }

        if (items.length === 0) {
          return (
            <AdminDashboardLargeChartPlaceholder placeholderText="No sharer data available yet" />
          );
        }

        return <TopSharersCarousel items={items} />;
      }}
    />
  );
};
