import { ReactElement } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { SeriesListResources } from './SeriesListResources';
import { SeriesListState } from './SeriesListState';
import styles from './SeriesList.module.css';
import { FullHeightDiv } from '../../../../shared/components/FullHeightDiv';
import { BottomNavBar } from '../../../bottomNav/BottomNavBar';
import { CourseCoverItemsList } from '../../../series/components/CourseCoverItemsList';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useOsehImageStateRequestHandler } from '../../../../shared/images/useOsehImageStateRequestHandler';

/**
 * The top-level component to show the series list screen, which
 * lets users browse the title cards for series and click to go
 * to the series details screen for that series.
 */
export const SeriesList = ({
  state: stateVWC,
  resources: resourcesVWC,
}: FeatureComponentProps<SeriesListState, SeriesListResources>): ReactElement => {
  const imageHandler = useOsehImageStateRequestHandler({});
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const listHeight = useMappedValueWithCallbacks(windowSizeVWC, (size) => size.height - 100);

  return (
    <div className={styles.container}>
      <FullHeightDiv className={styles.background} />
      <div className={styles.contentContainer}>
        <div className={styles.items}>
          <CourseCoverItemsList
            showCourse={() => {}}
            listHeight={listHeight}
            imageHandler={imageHandler}
          />
        </div>
      </div>
      <div className={styles.bottomNav}>
        <BottomNavBar
          active="series"
          clickHandlers={{
            home: () => stateVWC.get().setShow(false, true),
            account: () => resourcesVWC.get().gotoSettings(),
          }}
        />
      </div>
    </div>
  );
};
