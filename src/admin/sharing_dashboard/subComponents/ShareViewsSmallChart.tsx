import { ReactElement } from 'react';
import { NewUsersChart } from '../../dashboard/hooks/useNewUsersChart';
import { AdminDashboardSmallChart } from '../../dashboard/AdminDashboardSmallChart';
import { JourneyLinkViewStatsComplete } from '../models/JourneyLinkViewStats';
import { NetworkResponse } from '../../../shared/hooks/useNetworkResponse';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';

type ShareViewsChart = NewUsersChart;

export const ShareViewsSmallChart = ({
  linkViewStats,
}: {
  linkViewStats: NetworkResponse<JourneyLinkViewStatsComplete>;
}): ReactElement => {
  const chartVWC = useMappedValuesWithCallbacks(
    [linkViewStats.result, linkViewStats.error],
    (): ShareViewsChart => {
      const result = linkViewStats.result.get();
      const error = linkViewStats.error.get();

      if (result === null) {
        return {
          loading: true,
          error,
          labels: null,
          values: null,
        };
      }

      const values = [];
      const viewHydrated = result.historical.view_hydrated;
      const viewFollowed = result.historical.view_client_followed;
      for (let i = 0; i < result.historical.labels.length; i++) {
        values.push(viewHydrated[i] + viewFollowed[i]);
      }

      return {
        loading: false,
        labels: result.historical.labels,
        values,
      };
    }
  );

  return (
    <RenderGuardedComponent
      props={chartVWC}
      component={(chart) => (
        <AdminDashboardSmallChart
          name="Share Views"
          delta={chart.loading ? 0 : chart.values.reduce((a, b) => a + b, 0)}
          average={
            chart.loading
              ? 'Loading...'
              : `${Math.floor(
                  chart.values.reduce((a, b) => a + b, 0) / chart.values.length
                ).toLocaleString()} Daily Avg.`
          }
          labels={chart.labels ?? []}
          values={chart.values ?? []}
        />
      )}
    />
  );
};
