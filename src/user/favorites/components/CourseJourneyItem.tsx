import { ReactElement, useCallback, useContext } from 'react';
import { IconButton } from '../../../shared/forms/IconButton';
import styles from './CourseJourneyItem.module.css';
import { describeError } from '../../../shared/forms/ErrorBlock';
import { HTTP_API_URL, apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { textOverflowEllipses } from '../../../shared/lib/calculateKerningLength';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { MinimalCourseJourney } from '../lib/MinimalCourseJourney';
import { OsehContentRefLoadable } from '../../../shared/content/OsehContentRef';
import { ContentFileWebExport } from '../../../shared/content/OsehContentTarget';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useToggleFavorited } from '../../journey/hooks/useToggleFavorited';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { useErrorModal } from '../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../shared/contexts/ModalContext';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';

type HistoryItemProps = {
  /**
   * The item to render
   */
  item: ValueWithCallbacks<MinimalCourseJourney>;

  /**
   * If the user modifies the item, i.e., by favoriting/unfavoriting it,
   * the callback to update the item. This is called after the change is
   * already stored serverside.
   *
   * @param item The new item
   */
  setItem: (item: MinimalCourseJourney) => void;

  /**
   * A function which can be used to map all items to a new item. Used for
   * when the user performs an action that will impact items besides this
   * one, e.g., downloading this item will cause its isNext to be false,
   * and the next journey's isNext to be true.
   *
   * @param fn The function to apply to each item
   */
  mapItems: (fn: (item: MinimalCourseJourney) => MinimalCourseJourney) => void;

  /**
   * If true, a separator indicating the name of the course will be shown
   * above the block.
   */
  separator: ValueWithCallbacks<boolean>;

  /**
   * Called if the user clicks the item outside of the normally clickable
   * areas.
   */
  onClick?: () => void;

  /**
   * The request handler to use for instructor images
   */
  instructorImages: OsehImageStateRequestHandler;
};

/**
 * Renders a purchased journey for the courses / "Owned" tab, which they
 * may not have taken before.
 */
export const CourseJourneyItem = ({
  item: itemVWC,
  setItem,
  mapItems,
  separator: separatorVWC,
  onClick,
  instructorImages,
}: HistoryItemProps) => {
  const loginContextRaw = useContext(LoginContext);
  const instructorImageVWC = useOsehImageStateValueWithCallbacks(
    adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(
        itemVWC,
        (item) => ({
          ...item.journey.instructor.image,
          displayWidth: 14,
          displayHeight: 14,
          alt: 'profile',
        }),
        {
          outputEqualityFn: (a, b) => a.uid === b.uid && a.jwt === b.jwt,
        }
      )
    ),
    instructorImages
  );

  const likingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const toggleFavorited = useToggleFavorited({
    journey: adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(itemVWC, (item) => item.journey)
    ),
    shared: useMappedValueWithCallbacks(itemVWC, (item) => ({
      favorited: item.journey.likedAt !== null,
      setFavorited: (favorited: boolean) => {
        setItem({
          ...item,
          journey: {
            ...item.journey,
            likedAt: favorited ? new Date() : null,
          },
        });
      },
    })),
    knownUnfavoritable: adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(itemVWC, (item) => item.journey.lastTakenAt === null)
    ),
    working: likingVWC,
  });
  const onToggleFavorited = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorited();
    },
    [toggleFavorited]
  );

  const downloadingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const downloadErrorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const onDownload = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const loginContextUnch = loginContextRaw.value.get();
      if (loginContextUnch.state !== 'logged-in') {
        setVWC(downloadErrorVWC, <>You must be logged in to download</>);
        return;
      }
      const loginContext = loginContextUnch;

      const item = itemVWC.get();
      setVWC(downloadingVWC, true);
      setVWC(downloadErrorVWC, null);
      try {
        let response = await apiFetch(
          '/api/1/courses/start_journey_download',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: item.journey.uid,
              course_uid: item.course.uid,
            }),
          },
          loginContext
        );
        if (!response.ok) {
          throw response;
        }
        const data: {
          audio: OsehContentRefLoadable;
          video: OsehContentRefLoadable | null;
          last_taken_at: number;
        } = await response.json();
        const newLastTakenAt = new Date(data.last_taken_at * 1000);

        const contentFileRef = data.video ?? data.audio;

        response = await fetch(
          `${HTTP_API_URL}/api/1/content_files/${contentFileRef.uid}/web.json?presign=0`,
          {
            method: 'GET',
            headers: {
              Authorization: `bearer ${contentFileRef.jwt}`,
            },
          }
        );

        if (!response.ok) {
          throw response;
        }

        const contentFileData: {
          exports: {
            url: string;
            format: string;
            bandwidth: number;
            codecs: string[];
            file_size: number;
            quality_parameters: any;
            format_parameters: any;
          }[];
          duration_seconds: number;
        } = await response.json();

        let bestExport: ContentFileWebExport | null = null;
        let bestBandwidth = 0;
        for (const exportData of contentFileData.exports) {
          if (exportData.format !== 'mp4') {
            continue;
          }
          if (exportData.bandwidth > bestBandwidth) {
            bestExport = {
              url: exportData.url,
              format: exportData.format,
              bandwidth: exportData.bandwidth,
              codecs: exportData.codecs,
              fileSize: exportData.file_size,
              qualityParameters: exportData.quality_parameters,
              formatParameters: exportData.format_parameters,
            };
            bestBandwidth = exportData.bandwidth;
          }
        }

        if (bestExport === null) {
          setVWC(downloadErrorVWC, <>No suitable export found</>);
          return;
        }

        // If the download hostname differs from the current hostname,
        // we will download it completely and then click an anchor tag,
        // otherwise we'll just click the anchor tag.

        let urlToClick: string;
        const bestExportURL = new URL(bestExport.url);
        if (
          bestExportURL.hostname !== window.location.hostname ||
          bestExportURL.port !== window.location.port ||
          bestExportURL.protocol !== window.location.protocol
        ) {
          response = await fetch(bestExport.url, {
            method: 'GET',
            headers: { Authorization: `bearer ${contentFileRef.jwt}` },
          });

          const blob = await response.blob();
          urlToClick = URL.createObjectURL(blob);
        } else {
          urlToClick = bestExport.url + '?jwt=' + encodeURIComponent(contentFileRef.jwt);
        }

        const a = document.createElement('a');
        a.href = urlToClick;
        a.download = `Oseh_${item.journey.title}_${item.journey.instructor.name}.mp4`
          .replaceAll(' ', '-')
          .replaceAll(/[^a-zA-Z0-9-_]/g, '');
        a.click();

        if (!item.isNext) {
          setItem({
            ...item,
            journey: {
              ...item.journey,
              lastTakenAt: newLastTakenAt,
            },
          });
          return;
        }

        response = await apiFetch(
          '/api/1/courses/advance',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              course_uid: item.course.uid,
              journey_uid: item.journey.uid,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const advanceData: { new_next_journey_uid: string | null } = await response.json();

        let alreadySetNext = false;
        mapItems((i) => {
          if (i.associationUid === item.associationUid) {
            return {
              ...i,
              journey: {
                ...i.journey,
                lastTakenAt: new Date(),
              },
              isNext: false,
            };
          } else if (
            i.journey.uid === advanceData.new_next_journey_uid &&
            i.priority > item.priority &&
            !alreadySetNext
          ) {
            alreadySetNext = true;
            return {
              ...i,
              isNext: true,
            };
          }
          return i;
        });
      } catch (e) {
        console.log('error:', e);
        const err = await describeError(e);
        setVWC(downloadErrorVWC, err);
      } finally {
        setVWC(downloadingVWC, false);
      }
    },
    [downloadingVWC, downloadErrorVWC, itemVWC, loginContextRaw, mapItems, setItem]
  );

  const modalContext = useContext(ModalContext);
  useErrorModal(modalContext.modals, downloadErrorVWC, 'CourseJourneyItem download');

  const workingVWC = useMappedValuesWithCallbacks(
    [likingVWC, downloadingVWC],
    () => likingVWC.get() || downloadingVWC.get()
  );

  const ellipsedTitle = useMappedValueWithCallbacks(itemVWC, (item) =>
    textOverflowEllipses(item.journey.title, 13)
  );
  const takenVWC = useMappedValueWithCallbacks(
    itemVWC,
    (item) => item.journey.lastTakenAt !== null
  );
  const instructorName = useMappedValueWithCallbacks(
    itemVWC,
    (item) => item.journey.instructor.name
  );
  const favorited = useMappedValueWithCallbacks(itemVWC, (item) => item.journey.likedAt !== null);

  const workingAndFavoritedVWC = useMappedValuesWithCallbacks(
    [workingVWC, favorited],
    (): [boolean, boolean] => {
      return [workingVWC.get(), favorited.get()];
    },
    {
      outputEqualityFn: (a, b) => a[0] === b[0] && a[1] === b[1],
    }
  );

  return (
    <div onClick={onClick} className={styles.outerContainer}>
      <RenderGuardedComponent
        props={separatorVWC}
        component={(separator) => {
          if (!separator) {
            return <></>;
          }

          return (
            <RenderGuardedComponent
              props={itemVWC}
              component={(item) => {
                return <div className={styles.separator}>{item.course.title}</div>;
              }}
            />
          );
        }}
      />
      <div className={styles.container}>
        <RenderGuardedComponent
          props={takenVWC}
          component={(taken) =>
            taken ? (
              <div className={styles.checkContainer}>
                <div className={styles.checkIcon} />
              </div>
            ) : (
              <></>
            )
          }
        />
        <div className={styles.titleAndInstructor}>
          <div className={styles.title}>
            <RenderGuardedComponent props={ellipsedTitle} component={(t) => <>{t}</>} />
          </div>
          <div className={styles.instructor}>
            <div className={styles.instructorPictureContainer}>
              <OsehImageFromStateValueWithCallbacks state={instructorImageVWC} />
            </div>
            <div className={styles.instructorName}>
              <RenderGuardedComponent props={instructorName} component={(n) => <>{n}</>} />
            </div>
          </div>
        </div>
        <div className={styles.favoriteAndDownloadContainer}>
          <div className={styles.downloadIconWrapper}>
            <RenderGuardedComponent
              props={workingVWC}
              component={(working) => (
                <IconButton
                  icon={working ? styles.waitingIcon : styles.downloadIcon}
                  srOnlyName={'Download'}
                  onClick={onDownload}
                  disabled={working}
                />
              )}
            />
          </div>
          <RenderGuardedComponent
            props={workingAndFavoritedVWC}
            component={([working, favorited]) => (
              <IconButton
                icon={
                  working
                    ? styles.waitingIcon
                    : favorited
                    ? styles.favoritedIcon
                    : styles.unfavoritedIcon
                }
                srOnlyName={favorited ? 'Unlike' : 'Like'}
                onClick={onToggleFavorited}
                disabled={working}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
};
