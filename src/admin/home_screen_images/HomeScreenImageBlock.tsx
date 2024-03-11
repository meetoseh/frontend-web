import { ReactElement, useCallback } from 'react';
import { useMappedValueWithCallbacks } from '../../shared/hooks/useMappedValueWithCallbacks';
import { useWindowSizeValueWithCallbacks } from '../../shared/hooks/useWindowSize';
import { OsehImageFromStateValueWithCallbacks } from '../../shared/images/OsehImageFromStateValueWithCallbacks';
import { OsehImageProps } from '../../shared/images/OsehImageProps';
import { OsehImageStateRequestHandler } from '../../shared/images/useOsehImageStateRequestHandler';
import { useOsehImageStateValueWithCallbacks } from '../../shared/images/useOsehImageStateValueWithCallbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { secondsOffsetToInput } from '../../shared/lib/secondsOffsetUtils';
import { HomeScreenImage } from './HomeScreenImage';
import styles from './HomeScreenImageBlock.module.css';
import { HomeScreenImageFlags } from './flags/HomeScreenImageFlags';
import { useListItemExpandModal } from '../lib/useListItemExpandModal';
import { HomeScreenImageDetails } from './HomeScreenImageDetails';
import buttonStyles from '../../shared/buttons.module.css';
import { setVWC } from '../../shared/lib/setVWC';

type HomeScreenImageBlockProps = {
  /**
   * The home screen image to display
   */
  homeScreenImage: HomeScreenImage;

  /**
   * Used to update the home screen image after a confirmation from the server
   */
  setHomeScreenImage: (this: void, homeScreenImage: HomeScreenImage) => void;

  /**
   * The handler for loading images
   */
  imageHandler: OsehImageStateRequestHandler;
};

const allWeekdays =
  HomeScreenImageFlags.VISIBLE_MONDAY |
  HomeScreenImageFlags.VISIBLE_TUESDAY |
  HomeScreenImageFlags.VISIBLE_WEDNESDAY |
  HomeScreenImageFlags.VISIBLE_THURSDAY |
  HomeScreenImageFlags.VISIBLE_FRIDAY;

const allWeekends = HomeScreenImageFlags.VISIBLE_SUNDAY | HomeScreenImageFlags.VISIBLE_SATURDAY;

const allDays = allWeekdays | allWeekends;

const winter =
  HomeScreenImageFlags.VISIBLE_JANUARY |
  HomeScreenImageFlags.VISIBLE_FEBRUARY |
  HomeScreenImageFlags.VISIBLE_MARCH;
const spring =
  HomeScreenImageFlags.VISIBLE_APRIL |
  HomeScreenImageFlags.VISIBLE_MAY |
  HomeScreenImageFlags.VISIBLE_JUNE;
const summer =
  HomeScreenImageFlags.VISIBLE_JULY |
  HomeScreenImageFlags.VISIBLE_AUGUST |
  HomeScreenImageFlags.VISIBLE_SEPTEMBER;
const fall =
  HomeScreenImageFlags.VISIBLE_OCTOBER |
  HomeScreenImageFlags.VISIBLE_NOVEMBER |
  HomeScreenImageFlags.VISIBLE_DECEMBER;

const allMonths = winter | spring | summer | fall;

/**
 * Renders an admin home screen image as it should be shown in a listing
 */
export const HomeScreenImageBlock = ({
  homeScreenImage,
  setHomeScreenImage,
  imageHandler,
}: HomeScreenImageBlockProps) => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const imageSizeVWC = useMappedValueWithCallbacks(
    windowSizeVWC,
    (size) => {
      if (size.width < 390 + 24) {
        return { width: 360, height: 258 };
      }

      return { width: 390, height: 304 };
    },
    {
      outputEqualityFn: (a, b) => a.width === b.width && a.height === b.height,
    }
  );
  const backgroundPropsVWC = useMappedValueWithCallbacks(
    imageSizeVWC,
    (size): OsehImageProps => ({
      uid: homeScreenImage.darkenedImageFile.uid,
      jwt: homeScreenImage.darkenedImageFile.jwt,
      displayWidth: size.width,
      displayHeight: size.height,
      alt: '',
    })
  );
  const backgroundStateVWC = useOsehImageStateValueWithCallbacks(
    adaptValueWithCallbacksAsVariableStrategyProps(backgroundPropsVWC),
    imageHandler
  );

  const expandedVWC = useListItemExpandModal(
    useCallback(
      (_, editingVWC) => (
        <HomeScreenImageDetails
          homeScreenImage={homeScreenImage}
          setHomeScreenImage={setHomeScreenImage}
          imageHandler={imageHandler}
          editingVWC={editingVWC}
        />
      ),
      [homeScreenImage, setHomeScreenImage, imageHandler]
    )
  );

  return (
    <button
      className={buttonStyles.unstyled}
      onClick={(e) => {
        e.preventDefault();
        setVWC(expandedVWC, true);
      }}>
      <div className={styles.container}>
        <div className={styles.background}>
          <OsehImageFromStateValueWithCallbacks state={backgroundStateVWC} />
        </div>
        <div className={styles.foreground}>
          <div className={styles.foregroundInner}>
            <div className={styles.row}>
              <div className={styles.label}>Time of Day</div>
              <div className={styles.value}>
                {homeScreenImage.startTime === 0 && homeScreenImage.endTime === 86400
                  ? 'Any'
                  : `${secondsOffsetToInput(homeScreenImage.startTime)} to ${secondsOffsetToInput(
                      homeScreenImage.endTime
                    )}`}
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Day of Week</div>
              <div className={styles.value}>
                {(() => {
                  if ((homeScreenImage.flags & allDays) === allDays) {
                    return 'Any';
                  }
                  if ((homeScreenImage.flags & allDays) === 0) {
                    return 'None';
                  }
                  if (
                    (homeScreenImage.flags & allWeekends) === allWeekends &&
                    (homeScreenImage.flags & (allDays ^ allWeekends)) === 0
                  ) {
                    return 'Weekend';
                  }
                  if (
                    (homeScreenImage.flags & allWeekdays) === allWeekdays &&
                    (homeScreenImage.flags & (allDays ^ allWeekdays)) === 0
                  ) {
                    return 'Weekday';
                  }

                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const elements: ReactElement[] = [];
                  for (let i = 0; i < 7; i++) {
                    if (homeScreenImage.flags & (HomeScreenImageFlags.VISIBLE_SUNDAY << i)) {
                      const dayName = dayNames[i];
                      elements.push(<div key={i}>{dayName}</div>);
                    }
                  }
                  return <div className={styles.days}>{elements}</div>;
                })()}
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Months</div>
              <div className={styles.value}>
                {(() => {
                  if ((homeScreenImage.flags & allMonths) === allMonths) {
                    return 'Any';
                  }
                  if ((homeScreenImage.flags & allMonths) === 0) {
                    return 'None';
                  }
                  if (
                    (homeScreenImage.flags & winter) === winter &&
                    (homeScreenImage.flags & (allMonths ^ winter)) === 0
                  ) {
                    return 'Winter (Jan - Mar)';
                  }
                  if (
                    (homeScreenImage.flags & spring) === spring &&
                    (homeScreenImage.flags & (allMonths ^ spring)) === 0
                  ) {
                    return 'Spring (Apr - Jun)';
                  }
                  if (
                    (homeScreenImage.flags & summer) === summer &&
                    (homeScreenImage.flags & (allMonths ^ summer)) === 0
                  ) {
                    return 'Summer (Jul - Sep)';
                  }
                  if (
                    (homeScreenImage.flags & fall) === fall &&
                    (homeScreenImage.flags & (allMonths ^ fall)) === 0
                  ) {
                    return 'Fall (Oct - Dec)';
                  }

                  const months: ReactElement[] = [];
                  const monthNames = [
                    'Jan',
                    'Feb',
                    'Mar',
                    'Apr',
                    'May',
                    'June',
                    'July',
                    'Aug',
                    'Sep',
                    'Oct',
                    'Nov',
                    'Dec',
                  ];
                  const january = HomeScreenImageFlags.VISIBLE_JANUARY;

                  for (let i = 0; i < 12; i++) {
                    if (homeScreenImage.flags & (january << i)) {
                      const monthName = monthNames[i];
                      months.push(<div key={i}>{monthName}</div>);
                    }
                  }

                  return <div className={styles.days}>{months}</div>;
                })()}
              </div>
            </div>
            {homeScreenImage.dates !== null && (
              <div className={styles.row}>
                <div className={styles.label}>Dates</div>
                <div className={styles.value}>
                  {homeScreenImage.dates.length === 0 ? 'None' : undefined}
                  {(() => {
                    const asDates = homeScreenImage.dates.map(
                      (date) => new Date(date + 'T00:00:00')
                    );

                    if (homeScreenImage.dates.length < 3) {
                      return asDates.map((d) => d.toLocaleDateString()).join(', ');
                    }

                    const first = asDates[0];
                    let foundNonConsecutive = false;
                    for (let i = 1; i < asDates.length; i++) {
                      if (asDates[i].getTime() !== first.getTime() + i * 86_400_000) {
                        foundNonConsecutive = true;
                        break;
                      }
                    }

                    if (!foundNonConsecutive) {
                      return `${first.toLocaleDateString()} to ${asDates[
                        asDates.length - 1
                      ].toLocaleDateString()}`;
                    }

                    return (
                      asDates[0].toLocaleDateString() +
                      ' + ' +
                      (homeScreenImage.dates.length - 1) +
                      ' more'
                    );
                  })()}
                </div>
              </div>
            )}
            <div className={styles.row}>
              <div className={styles.label}>Free Users</div>
              <div className={styles.value}>
                {(homeScreenImage.flags & HomeScreenImageFlags.VISIBLE_WITHOUT_PRO) !== 0
                  ? 'Yes'
                  : 'No'}
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.label}>Pro Users</div>
              <div className={styles.value}>
                {(homeScreenImage.flags & HomeScreenImageFlags.VISIBLE_WITH_PRO) !== 0
                  ? 'Yes'
                  : 'No'}
              </div>
            </div>
            {homeScreenImage.liveAt > new Date() && (
              <div className={styles.row}>
                <div className={styles.label}>Live At</div>
                <div className={styles.value}>{homeScreenImage.liveAt.toLocaleDateString()}</div>
              </div>
            )}
            {(homeScreenImage.flags & HomeScreenImageFlags.VISIBLE_IN_ADMIN) === 0 && (
              <div className={styles.row}>
                <div className={styles.label}>Visible in Admin</div>
                <div className={styles.value}>No</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};
