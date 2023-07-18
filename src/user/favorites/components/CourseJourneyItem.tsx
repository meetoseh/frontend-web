import { ReactElement, useCallback, useContext, useMemo } from 'react';
import { IconButton } from '../../../shared/forms/IconButton';
import styles from './CourseJourneyItem.module.css';
import { describeError } from '../../../shared/forms/ErrorBlock';
import { HTTP_API_URL, apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { textOverflowEllipses } from '../../../shared/lib/calculateKerningLength';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { MinimalCourseJourney } from '../lib/MinimalCourseJourney';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { OsehContentRefLoadable } from '../../../shared/content/OsehContentRef';
import { ContentFileWebExport } from '../../../shared/content/OsehContentTarget';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { useToggleFavorited } from '../../journey/hooks/useToggleFavorited';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useReactManagedValueAsValueWithCallbacks } from '../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { useErrorModal } from '../../../shared/hooks/useErrorModal';
import { ModalContext } from '../../../shared/contexts/ModalContext';

type HistoryItemProps = {
  /**
   * The item to render
   */
  item: MinimalCourseJourney;

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
  separator?: boolean;

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
  item,
  setItem,
  mapItems,
  separator,
  onClick,
  instructorImages,
}: HistoryItemProps) => {
  const loginContext = useContext(LoginContext);
  const instructorImage = useOsehImageStateValueWithCallbacks(
    {
      type: 'react-rerender',
      props: {
        ...item.journey.instructor.image,
        displayWidth: 14,
        displayHeight: 14,
        alt: 'profile',
      },
    },
    instructorImages
  );

  const likingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const itemVWC = useReactManagedValueAsValueWithCallbacks(item);
  const toggleFavorited = useToggleFavorited({
    journey: item.journey,
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
    knownUnfavoritable: {
      type: 'react-rerender',
      props: item.journey.lastTakenAt === null,
    },
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
              codecs: exportData.codecs as Array<'aac'>,
              fileSize: exportData.file_size,
              qualityParameters: exportData.quality_parameters,
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
    [downloadingVWC, downloadErrorVWC, item, loginContext, mapItems, setItem]
  );

  const modalContext = useContext(ModalContext);
  useErrorModal(modalContext.modals, downloadErrorVWC, 'CourseJourneyItem download');

  const workingVWC = useMappedValuesWithCallbacks(
    [likingVWC, downloadingVWC],
    () => likingVWC.get() || downloadingVWC.get()
  );

  const ellipsedTitle = useMemo(
    () => textOverflowEllipses(item.journey.title, 13),
    [item.journey.title]
  );

  return (
    <div onClick={onClick} className={styles.outerContainer}>
      {separator && <div className={styles.separator}>{item.course.title}</div>}
      <div
        className={combineClasses(
          styles.container,
          item.isNext ? styles.containerIsNext : undefined
        )}>
        {item.journey.lastTakenAt !== null && (
          <div className={styles.checkContainer}>
            <div className={styles.checkIcon} />
          </div>
        )}
        <div className={styles.titleAndInstructor}>
          <div className={styles.title}>{ellipsedTitle}</div>
          <div className={styles.instructor}>
            <div className={styles.instructorPictureContainer}>
              <OsehImageFromStateValueWithCallbacks state={instructorImage} />
            </div>
            <div className={styles.instructorName}>{item.journey.instructor.name}</div>
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
            props={workingVWC}
            component={(working) => (
              <IconButton
                icon={
                  working
                    ? styles.waitingIcon
                    : item.journey.likedAt === null
                    ? styles.unfavoritedIcon
                    : styles.favoritedIcon
                }
                srOnlyName={item.journey.likedAt === null ? 'Like' : 'Unlike'}
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
