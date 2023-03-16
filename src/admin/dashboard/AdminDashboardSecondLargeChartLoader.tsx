import { ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import { addModalWithCallbackToRemove, ModalContext } from '../../shared/ModalContext';
import { ModalWrapper } from '../../shared/ModalWrapper';
import {
  AdminDashboardLargeChart,
  AdminDashboardLargeChartItem,
  AdminDashboardLargeChartMonthlyItem,
} from './AdminDashboardLargeChart';
import { AdminDashboardLargeChartPlaceholder } from './AdminDashboardLargeChartPlaceholder';
import { NewUsersChart } from './hooks/useNewUsersChart';
import { NewUsersDetails } from './subComponents/NewUsersDetails';

type AdminDashboardSecondLargeChartLoaderProps = {
  /**
   * The new users chart, which is loaded by the parent since it's used in
   * multiple places
   */
  newUsersChart: NewUsersChart;
};

/**
 * Loads the second large chart on the admin dashboard, and renders the chart
 * when the data is ready, with a placeholder to prevent the page from jumping
 * around while the data is loading.
 */
export const AdminDashboardSecondLargeChartLoader = ({
  newUsersChart,
}: AdminDashboardSecondLargeChartLoaderProps): ReactElement => {
  const modalContext = useContext(ModalContext);
  const [showNewUsersHelp, setShowNewUsersHelp] = useState(false);

  const newUsersChartItem = useMemo<AdminDashboardLargeChartItem | undefined>(() => {
    if (newUsersChart.loading) {
      return;
    }

    return {
      identifier: 'new-users',
      name: 'New Users',
      labels: newUsersChart.labels,
      values: newUsersChart.values,
      help: () => {
        setShowNewUsersHelp(true);
      },
    };
  }, [newUsersChart]);

  const dailyCharts = useMemo<AdminDashboardLargeChartItem[]>(() => {
    let result: AdminDashboardLargeChartItem[] = [];
    if (newUsersChartItem !== undefined) {
      result.push(newUsersChartItem);
    }
    return result;
  }, [newUsersChartItem]);

  const monthlyCharts = useMemo<AdminDashboardLargeChartMonthlyItem[]>(() => [], []);

  useEffect(() => {
    if (!showNewUsersHelp) {
      return;
    }

    return addModalWithCallbackToRemove(
      modalContext.setModals,
      <ModalWrapper onClosed={() => setShowNewUsersHelp(false)}>
        <NewUsersDetails chart={newUsersChart!} />
      </ModalWrapper>
    );
  }, [modalContext.setModals, showNewUsersHelp, newUsersChart]);

  if (newUsersChart.loading) {
    return <AdminDashboardLargeChartPlaceholder />;
  }

  return <AdminDashboardLargeChart dailyCharts={dailyCharts} monthlyCharts={monthlyCharts} />;
};
