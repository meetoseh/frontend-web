import {
  CSSProperties,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LoginContext } from '../../shared/LoginContext';
import { MyProfilePicture } from '../../shared/MyProfilePicture';
import { OsehImage } from '../../shared/OsehImage';
import { DailyEvent, DailyEventJourney } from './DailyEvent';
import styles from './DailyEventView.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { apiFetch } from '../../shared/ApiConstants';
import { describeError, ErrorBlock } from '../../shared/forms/ErrorBlock';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { useFullHeight } from '../../shared/hooks/useFullHeight';
import { JourneyRef, journeyRefKeyMap } from '../journey/models/JourneyRef';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import { FullscreenContext } from '../../shared/FullscreenContext';
import { shuffle } from '../../shared/lib/shuffle';

type DailyEventViewProps = {
  /**
   * The event this is a view for
   */
  event: DailyEvent;

  /**
   * Called when we're loading resources to show the daily event, or
   * we're done loading. Can be used to display a splash screen rather
   * than placeholders
   *
   * @param loading True if we're loading, false otherwise
   */
  setLoading: (this: void, loading: boolean) => void;

  /**
   * Called when we receive a ref to the journey that the user should be directed
   * to
   *
   * @param journey The journey that the user should be directed to
   */
  setJourney: (this: void, journey: JourneyRef) => void;
};

/**
 * Category external names which some people really like, but others really dislike.
 * This is contrasted with categories which tend not to illicit negative reactions
 */
const DIVISIVE_CATEGORIES = new Set(['Instrumental', 'Poetry']);

/**
 * Performs a biased shuffling of the cards in the journey, preferring to
 * move content that can be more divisive to anything but the front card.
 *
 * @param journeys The journeys to produce an ordering of
 * @returns The indices of the journeys in the order they should be shown
 */
const createJourneyShuffle = (journeys: DailyEventJourney[]): number[] => {
  if (journeys.length === 0) {
    return [];
  }

  const result: number[] = [];
  for (let i = 0; i < journeys.length; i++) {
    result.push(i);
  }
  shuffle(result);

  if (DIVISIVE_CATEGORIES.has(journeys[result[0]].category.externalName)) {
    const firstNonDivisive = result.findIndex(
      (i) => !DIVISIVE_CATEGORIES.has(journeys[i].category.externalName)
    );
    if (firstNonDivisive !== -1) {
      const tmp = result[0];
      result[0] = result[firstNonDivisive];
      result[firstNonDivisive] = tmp;
    }
  }
  return result;
};

/**
 * Shows the specified daily event and allows the user to take actions as
 * appropriate for the indicated access level
 */
export const DailyEventView = ({
  event,
  setLoading,
  setJourney,
}: DailyEventViewProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const fullscreenContext = useContext(FullscreenContext);
  const [loadedImagesByUID, setLoadedImagesByUID] = useState<{ [uid: string]: boolean }>({});
  const [carouselOrder, setCarouselOrder] = useState<number[]>([]);
  const [activeJourney, setActiveJourney] = useState<string>('');
  const [carouselTargetTransformX, setCarouselTargetTransformX] = useState<number>(0);
  const [carouselTransformX, setCarouselTransformX] = useState<number>(0);
  const windowSize = useWindowSize();
  const carouselSettings = useCarouselSettings(windowSize);
  const [onScrollCooldown, setOnScrollCooldown] = useState<boolean>(false);
  const carouselMouseDragSum = useRef<number>(0);
  const [haveCarouselMouseDragged, setHaveCarouselMouseDragged] = useState<boolean>(false);
  const clearCarouselMouseDragTimeout = useRef<() => void>(() => {});
  const carouselTouchStartX = useRef<number>(0);
  const carouselTouchMoveSum = useRef<number>(0);
  const [haveCarouselTouchMoved, setHaveCarouselTouchMoved] = useState<boolean>(false);
  const [startingJourney, setStartingJourney] = useState<boolean>(false);
  const [error, setError] = useState<ReactElement | null>(null);
  const [profilePictureAvailable, setProfilePictureAvailable] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useFullHeight({ element: containerRef, attribute: 'minHeight', windowSize });

  useEffect(() => {
    setLoadedImagesByUID((u) => {
      // remove loaded images that are no longer part of the event
      const newLoadedImageUIDs = event.journeys
        .map((j) => j.backgroundImage.uid)
        .filter((uid) => !!u[uid]);
      const newLoadedImages: { [uid: string]: boolean } = {};
      for (const uid of newLoadedImageUIDs) {
        newLoadedImages[uid] = true;
      }
      return newLoadedImages;
    });
  }, [event.journeys]);

  useEffect(() => {
    setLoading(event.journeys.some((j) => !loadedImagesByUID[j.backgroundImage.uid]));
  }, [event.journeys, loadedImagesByUID, setLoading]);

  useEffect(() => {
    const newCarouselOrder = createJourneyShuffle(event.journeys);

    setCarouselOrder(newCarouselOrder);
    setActiveJourney(event.journeys.length > 0 ? event.journeys[0].uid : '');
  }, [event.journeys]);

  const onImageSetLoading = useCallback((loading: boolean, uid: string | null) => {
    if (uid === null) {
      return;
    }

    setLoadedImagesByUID((u) => ({
      ...u,
      [uid]: !loading,
    }));
  }, []);

  const calculateTransformForIndex = useCallback(
    (idx: number) => {
      const itemWidth = carouselSettings.itemSize.width;
      const itemGutter = carouselSettings.gap;

      const offsetOfFirstIndexWithNoTransform = 0;
      const activeIndexDesiredOffset = windowSize.width / 2 - itemWidth / 2;

      const idxOffsetWithNoTransform =
        offsetOfFirstIndexWithNoTransform + idx * (itemWidth + itemGutter);
      return activeIndexDesiredOffset - idxOffsetWithNoTransform;
    },
    [windowSize.width, carouselSettings]
  );

  useEffect(() => {
    if (haveCarouselMouseDragged || haveCarouselTouchMoved) {
      return;
    }

    setCarouselTargetTransformX(
      calculateTransformForIndex(
        carouselOrder.map((i) => event.journeys[i].uid).indexOf(activeJourney)
      )
    );
  }, [
    activeJourney,
    carouselOrder,
    event.journeys,
    calculateTransformForIndex,
    haveCarouselMouseDragged,
    haveCarouselTouchMoved,
  ]);

  const onJourneyCarouselScroll = useCallback(
    (e: WheelEvent) => {
      if (carouselOrder.length !== event.journeys.length) {
        return;
      }

      if (onScrollCooldown) {
        return;
      }

      setOnScrollCooldown(true);
      const activeJourneyIndex = carouselOrder
        .map((i) => event.journeys[i].uid)
        .indexOf(activeJourney);

      const deltaXSign = Math.sign(e.deltaX !== 0 ? e.deltaX : e.deltaY);
      setActiveJourney(
        event.journeys[
          carouselOrder[
            (activeJourneyIndex + deltaXSign + event.journeys.length) % event.journeys.length
          ]
        ].uid
      );
    },
    [onScrollCooldown, carouselOrder, event.journeys, activeJourney]
  );

  useEffect(() => {
    window.addEventListener('wheel', onJourneyCarouselScroll);

    return () => {
      window.removeEventListener('wheel', onJourneyCarouselScroll);
    };
  }, [onJourneyCarouselScroll]);

  const onJourneyCarouselMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // is left mouse button pressed?
      if (e.buttons !== 1) {
        return;
      }

      if (!haveCarouselMouseDragged) {
        setHaveCarouselMouseDragged(true);
      }

      clearCarouselMouseDragTimeout.current();
      clearCarouselMouseDragTimeout.current = (() => {
        let timeout: NodeJS.Timeout | null = setTimeout(() => {
          timeout = null;
          setHaveCarouselMouseDragged(false);
        }, 100);

        return () => {
          if (timeout !== null) {
            clearTimeout(timeout);
          }
        };
      })();

      carouselMouseDragSum.current += e.movementX;
    },
    [haveCarouselMouseDragged]
  );

  const onJourneyCarouselTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (haveCarouselTouchMoved) {
        return;
      }

      setHaveCarouselTouchMoved(true);
      carouselTouchStartX.current = e.touches[0].clientX;
    },
    [haveCarouselTouchMoved]
  );

  const onJourneyCarouselTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!haveCarouselTouchMoved) {
        return;
      }

      setHaveCarouselTouchMoved(false);
    },
    [haveCarouselTouchMoved]
  );

  const onJourneyCarouselTouchMove = useCallback((e: React.TouchEvent) => {
    carouselTouchMoveSum.current += e.touches[0].clientX - carouselTouchStartX.current;
    carouselTouchStartX.current = e.touches[0].clientX;
  }, []);

  useEffect(() => {
    if (!haveCarouselMouseDragged) {
      return;
    }

    let active = true;
    const onAnimFrame = () => {
      if (!active) {
        return;
      }

      if (Math.abs(carouselMouseDragSum.current) > 0) {
        setCarouselTargetTransformX((t) =>
          Math.max(
            Math.min(t + carouselMouseDragSum.current * 3, calculateTransformForIndex(0)),
            calculateTransformForIndex(event.journeys.length - 1)
          )
        );
        carouselMouseDragSum.current = 0;
      }

      requestAnimationFrame(onAnimFrame);
    };

    requestAnimationFrame(onAnimFrame);

    return () => {
      active = false;
    };
  }, [haveCarouselMouseDragged, event.journeys.length, calculateTransformForIndex]);

  useEffect(() => {
    if (!haveCarouselTouchMoved) {
      return;
    }

    let active = true;
    const onAnimFrame = () => {
      if (!active) {
        return;
      }

      if (Math.abs(carouselTouchMoveSum.current) > 0) {
        setCarouselTargetTransformX((t) =>
          Math.max(
            Math.min(t + carouselTouchMoveSum.current * 3, calculateTransformForIndex(0)),
            calculateTransformForIndex(event.journeys.length - 1)
          )
        );
        carouselTouchMoveSum.current = 0;
      }

      requestAnimationFrame(onAnimFrame);
    };

    requestAnimationFrame(onAnimFrame);

    return () => {
      active = false;
    };
  }, [haveCarouselTouchMoved, event.journeys.length, calculateTransformForIndex]);

  useEffect(() => {
    if (!haveCarouselMouseDragged && !haveCarouselTouchMoved) {
      return;
    }

    const offsetOfFirstIdx = calculateTransformForIndex(0);
    const itemWidth = carouselSettings.itemSize.width;
    const itemGutter = carouselSettings.gap;

    const nearestIdx = -Math.round(
      (carouselTargetTransformX - offsetOfFirstIdx) / (itemWidth + itemGutter)
    );

    setActiveJourney(event.journeys[carouselOrder[nearestIdx]].uid);
  }, [
    haveCarouselMouseDragged,
    haveCarouselTouchMoved,
    carouselTargetTransformX,
    calculateTransformForIndex,
    event.journeys,
    carouselOrder,
    carouselSettings,
  ]);

  const cancelDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!onScrollCooldown) {
      return;
    }

    let timeout: NodeJS.Timeout | null = setTimeout(() => {
      timeout = null;
      setOnScrollCooldown(false);
    }, 500);

    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  }, [onScrollCooldown]);

  useEffect(() => {
    setCarouselTransformX(carouselTargetTransformX);
  }, [carouselTargetTransformX]);

  const onChooseForMe = useCallback(async () => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    setStartingJourney(true);
    try {
      const response = await apiFetch(
        '/api/1/daily_events/start_random',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            uid: event.uid,
            jwt: event.jwt,
          }),
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      const journey: JourneyRef = convertUsingKeymap(data, journeyRefKeyMap);
      setJourney(journey);
    } catch (e) {
      console.error(e);
      const err = await describeError(e);
      setError(err);
    } finally {
      setStartingJourney(false);
    }
  }, [loginContext, event.uid, event.jwt, setJourney]);

  const showUpgradeModal = useCallback(() => {
    console.log('would show upgrade modal');
  }, []);

  const onChooseSpecific = useCallback(
    async (index: number) => {
      if (loginContext.state !== 'logged-in') {
        return;
      }

      const journey = event.journeys[index];
      if (!journey.access.start) {
        showUpgradeModal();
        return;
      }

      setStartingJourney(true);
      try {
        const response = await apiFetch(
          '/api/1/daily_events/start_specific',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              daily_event_uid: event.uid,
              daily_event_jwt: event.jwt,
              journey_uid: event.journeys[index].uid,
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }

        const data = await response.json();
        const journey = convertUsingKeymap(data, journeyRefKeyMap);
        setJourney(journey);
      } catch (e) {
        console.error(e);
        const err = await describeError(e);
        setError(err);
      } finally {
        setStartingJourney(false);
      }
    },
    [loginContext, event.uid, event.jwt, event.journeys, setJourney, showUpgradeModal]
  );

  const boundOnChooseSpecific: ((e: React.MouseEvent) => void)[] = useMemo(() => {
    return event.journeys.map((_, i) => (e: React.MouseEvent) => {
      e.preventDefault();
      onChooseSpecific(i);
    });
  }, [onChooseSpecific, event.journeys]);

  const carouselItems = useMemo(() => {
    return carouselOrder
      .map((i) => [event.journeys[i], i] as const)
      .map(([journey, i]) => {
        const inner = (
          <>
            <div className={styles.journeyImageContainer}>
              <OsehImage
                uid={journey.backgroundImage.uid}
                jwt={journey.backgroundImage.jwt}
                displayWidth={carouselSettings.itemSize.width}
                displayHeight={carouselSettings.itemSize.height}
                alt=""
                setLoading={onImageSetLoading}
              />
            </div>

            <div className={styles.journeyCategoryContainer}>
              <div className={styles.journeyCategory}>{journey.category.externalName}</div>
            </div>

            {!journey.access.start && (
              <div className={styles.journeyLockedContainer}>
                <div className={styles.journeyLocked}>
                  <div className={styles.lockIcon}></div>
                  <div className={assistiveStyles.srOnly}>Locked</div>
                </div>
              </div>
            )}

            <div
              className={styles.journeyInfoContainer}
              style={
                carouselSettings.journeyInfoTopPercentage === undefined
                  ? undefined
                  : {
                      top: `${carouselSettings.journeyInfoTopPercentage}%`,
                      height: `${100 - carouselSettings.journeyInfoTopPercentage}%`,
                    }
              }>
              <div className={styles.journeyTitle}>{journey.title}</div>
              <div className={styles.journeyInstructor}>{journey.instructor.name}</div>
              <div className={styles.journeyDescription}>{journey.description.text}</div>
            </div>
          </>
        );

        const containerStyle: CSSProperties = {
          width: `${carouselSettings.itemSize.width}px`,
          height: `${carouselSettings.itemSize.height}px`,
          marginLeft:
            journey.uid === event.journeys[carouselOrder[0]].uid
              ? '0'
              : `${carouselSettings.gap}px`,
          transform:
            journey.uid === activeJourney
              ? `translateY(-${carouselSettings.activeCardRaised}px)`
              : 'translateY(0)',
        };

        if (!journey.access.start) {
          return (
            <a
              href="/upgrade"
              className={styles.journeyContainer}
              style={containerStyle}
              key={journey.uid}>
              {inner}
            </a>
          );
        }

        return (
          <button
            className={styles.journeyContainer}
            style={containerStyle}
            onClick={boundOnChooseSpecific[i]}
            disabled={startingJourney}
            key={journey.uid}>
            {inner}
          </button>
        );
      });
  }, [
    event.journeys,
    activeJourney,
    boundOnChooseSpecific,
    carouselOrder,
    carouselSettings,
    onImageSetLoading,
    startingJourney,
  ]);

  if (loginContext.state !== 'logged-in') {
    return <></>;
  }

  return (
    <div className={styles.container} ref={containerRef}>
      {fullscreenContext.fullscreen ? (
        <div className={styles.closeButtonContainer}>
          <div className={styles.closeButtonInnerContainer}>
            <button
              type="button"
              className={styles.close}
              onClick={fullscreenContext.exitFullscreen}>
              <div className={styles.closeIcon} />
              <div className={assistiveStyles.srOnly}>Close</div>
            </button>
          </div>
        </div>
      ) : null}
      <div className={styles.innerContainer}>
        <a
          href="/settings"
          className={styles.headerLink}
          style={{
            paddingTop: `${carouselSettings.headingPadding.top}px`,
            paddingBottom: `${
              carouselSettings.headingPadding.bottom - carouselSettings.activeCardRaised
            }px`,
          }}>
          <div className={styles.headerContainer}>
            <div className={styles.headerProfileOuterContainer}>
              <div
                className={styles.headerProfileContainer}
                style={profilePictureAvailable ? {} : { display: 'none' }}>
                <MyProfilePicture
                  displayWidth={48}
                  displayHeight={48}
                  setAvailable={setProfilePictureAvailable}
                />
              </div>
            </div>
            <div className={styles.headerTextContainer}>
              <div className={styles.subheader}>
                Hi {loginContext.userAttributes?.givenName ?? ''} 👋
              </div>
              <div className={styles.header}>Choose today's journey</div>
            </div>
          </div>
        </a>

        <div
          className={styles.journeyCarouselContainer}
          onMouseMove={onJourneyCarouselMouseMove}
          onTouchStart={onJourneyCarouselTouchStart}
          onTouchMove={onJourneyCarouselTouchMove}
          onTouchEnd={onJourneyCarouselTouchEnd}
          onDragStart={cancelDrag}
          onDrag={cancelDrag}>
          <div
            className={`${styles.journeyCarousel} ${
              haveCarouselMouseDragged || haveCarouselTouchMoved
                ? styles.journeyCarouselDragging
                : ''
            }`}
            style={{
              transform: `translateX(${carouselTransformX}px)`,
              width: `${
                event.journeys.length * carouselSettings.itemSize.width +
                (event.journeys.length - 1) * carouselSettings.gap
              }px`,
              height: `${carouselSettings.itemSize.height + carouselSettings.activeCardRaised}px`,
            }}>
            {carouselItems}
          </div>
        </div>

        <div
          className={styles.chooseForMeContainer}
          style={{
            paddingTop: `${carouselSettings.buttonPadding.top}px`,
            paddingBottom: `${carouselSettings.buttonPadding.bottom}px`,
          }}>
          {error && <ErrorBlock>{error}</ErrorBlock>}
          {event.access.startRandom ? (
            <button
              type="button"
              className={styles.chooseForMeButton}
              disabled={!event.access.startRandom || startingJourney}
              onClick={onChooseForMe}>
              {event.journeys.some((j) => j.access.start)
                ? 'Choose For Me'
                : 'Start Your Free Class'}
            </button>
          ) : (
            <>
              <a href="/upgrade" className={styles.upgradeLink}>
                Upgrade to Oseh+
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

type CarouselSettings = {
  /**
   * The size of each card, in pixels
   */
  itemSize: { width: number; height: number };

  /**
   * The gap between cards, in pixels
   */
  gap: number;

  /**
   * The padding above and below the header, in pixels
   */
  headingPadding: { top: number; bottom: number };

  /**
   * The amount in pixels we move the active card up compared to
   * the other cards, in pixels
   */
  activeCardRaised: number;

  /**
   * The padding above and below the button, in pixels
   */
  buttonPadding: { top: number; bottom: number };

  /**
   * If we should override the journey info top to be a different
   * percentage to make space, the new percentage (e.g., 60 for 60%
   * from the top), or undefined if we should not override.
   *
   * The height should always be 100-overridePercentage when overriding
   */
  journeyInfoTopPercentage?: number | undefined;
};

/**
 * A basic useEffect wrapper around computeCarouselSettings. See
 * computeCarouselSettings for more details.
 */
const useCarouselSettings = (windowSize: { width: number; height: number }): CarouselSettings => {
  const [settings, setSettings] = useState(() => computeCarouselSettings(windowSize));

  useEffect(() => {
    setSettings(computeCarouselSettings(windowSize));
  }, [windowSize]);

  return settings;
};

/**
 * Computes appropriate carousel settings to balance the following:
 * - We want the card to be fairly close to 3x5 aspect ratio
 * - We want the card to appear as the most prominent element on the screen,
 *   i.e., as large as possible
 * - We want it to be clear it's a carousel, i.e., we want at least 12px of
 *   the other cards on either side of the active card to be visible
 * - We want there to be enough space for the other elements on the screen
 *   with an acceptable amount of padding. The other elements are:
 *   - the padding above the header, varying space
 *   - the header, which takes up 56px
 *   - the padding below the header, varying space
 *   - The active element is slightly above the rest, taking up varying amount
 *     of height
 *   - the padding above the button, varying space
 *   - the button, which takes up 56px
 *   - the padding below the button, varying space
 * - We want to know the image sizes we use in advance, so the server can
 *   precompute and precompress the images. If we request a size that is
 *   not precomputed, it will cost us significant time when downloading
 *   and rendering the image.
 */
const computeCarouselSettings = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): CarouselSettings => {
  // smallest width we're going to handle well: iPhone 13 at 25% zoom; 390/1.25 = 312
  // smallest height we're going to handle well: iPhone 13 at 25% zoom with 80px of header
  // = (844 - 80) / 1.25 = 611

  // largest size we'll handle well: iPhone 14 full screen; 390 x 844
  // we will assume that if there is more height available than we use, we're vertically
  // centered.

  if (width >= 390 && height >= 844) {
    // reference size
    // actual height used: 56 + 96 + 500 + 60 + 56 = 768; remaining 76 split evenly above and below
    // card bleed: (390 - 300 - 24*2)/2 = 21px
    return {
      itemSize: { width: 300, height: 500 },
      gap: 24,
      headingPadding: { top: 0, bottom: 96 },
      activeCardRaised: 32,
      buttonPadding: { top: 60, bottom: 0 },
    };
  }

  if (width >= 372 && height >= 721) {
    // For (390, 844) - (372, 721) = (18, 123) we will:
    // start
    // {
    //   itemSize: { width: 300, height: 500 },
    //   gap: 24,
    //   headingPadding: { top: 38, bottom: 96 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 60, bottom: 38 },
    // }
    //
    // width:
    //   |-------------------------------------------------------------|
    //   | location        | initial | end  | pixels saved | remaining |
    //   |                 |         |      |              | 18px      |
    //   | left card bleed | 21px    | 12px | 9px          | 9px       |
    //   | right card bleed| 21px    | 12px | 9px          | 0         |
    //   |-------------------------------------------------------------|

    // height:
    //   |-------------------------------------------------------------|
    //   | location        | initial | end  | pixels saved | remaining |
    //   |                 |         |      |              | 123px     |
    //   | header top      | 38px    | 24px | 14px         | 109px     |
    //   | header bottom   | 96px    | 48px | 48px         | 61px      |
    //   | button top      | 60px    | 12px | 48px         | 13px      |
    //   | button bottom   | 38px    | 25px | 13px         | 0         |
    //   |-------------------------------------------------------------|

    const heightScale = { start: 844, end: 721, current: height };

    return {
      itemSize: { width: 300, height: 500 },
      gap: 24,
      headingPadding: {
        top: scaleLinearly(heightScale, 38, 24),
        bottom: scaleLinearly(heightScale, 96, 48),
      },
      activeCardRaised: 32,
      buttonPadding: {
        top: scaleLinearly(heightScale, 60, 12),
        bottom: scaleLinearly(heightScale, 38, 25),
      },
    };
  }

  if (width >= 343 && height >= 721) {
    // For (371, 844) - (343, 721) = (28, 123) we will:
    // start
    // {
    //   itemSize: { width: 287, height: 500 },
    //   gap: 24,
    //   headingPadding: { top: 38, bottom: 96 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 60, bottom: 38 },
    // }
    //
    // width:
    //   |--------------------------------------------------------------|
    //   | location         | initial | end  | pixels saved | remaining |
    //   |                  |         |      |              | 28px      |
    //   | left gap         | 24px    | 16px | 8px          | 20px      |
    //   | right gap        | 24px    | 16px | 8px          | 12px      |
    //   | left card bleed  | 18px    | 12px | 6px          | 6px       |
    //   | right card bleed | 18px    | 12px | 6px          | 0         |
    //   |--------------------------------------------------------------|

    // height:
    //   |-------------------------------------------------------------|
    //   | location        | initial | end  | pixels saved | remaining |
    //   |                 |         |      |              | 123px     |
    //   | header top      | 38px    | 24px | 14px         | 109px     |
    //   | header bottom   | 96px    | 48px | 48px         | 61px      |
    //   | button top      | 60px    | 12px | 48px         | 13px      |
    //   | button bottom   | 38px    | 25px | 13px         | 0         |
    //   |-------------------------------------------------------------|

    const heightScale = { start: 844, end: 721, current: height };
    const widthScale = { start: 371, end: 343, current: width };

    return {
      itemSize: { width: 287, height: 500 },
      gap: Math.floor(scaleLinearly(widthScale, 24, 16)),
      headingPadding: {
        top: scaleLinearly(heightScale, 38, 24),
        bottom: scaleLinearly(heightScale, 96, 48),
      },
      activeCardRaised: 32,
      buttonPadding: {
        top: scaleLinearly(heightScale, 60, 12),
        bottom: scaleLinearly(heightScale, 38, 25),
      },
    };
  }

  if (width >= 343 && height >= 651) {
    // For (390, 720) - (343, 651) = (47, 69) we will:
    // start
    // {
    //   itemSize: { width: 275, height: 457 },
    //   gap: 22,
    //   headingPadding: { top: 26, bottom: 64 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 38, bottom: 23 },
    // }
    //
    // width:
    //   |--------------------------------------------------------------|
    //   | location         | initial | end  | pixels saved | remaining |
    //   |                  |         |      |              | 47px      |
    //   | left card bleed  | 35px    | 12px | 23px         | 24px      |
    //   | right card bleed | 36px    | 12px | 24px         | 0         |
    //   |--------------------------------------------------------------|

    // height:
    //   |-------------------------------------------------------------|
    //   | location        | initial | end  | pixels saved | remaining |
    //   |                 |         |      |              | 69px      |
    //   | header top      | 26px    | 13px | 13px         | 56px      |
    //   | header bottom   | 64px    | 42px | 22px         | 34px      |
    //   | button top      | 38px    | 11px | 27px         | 7px       |
    //   | button bottom   | 23px    | 16px | 7px          | 0px       |
    //   |-------------------------------------------------------------|

    const heightScale = { start: 720, end: 651, current: height };

    return {
      itemSize: { width: 275, height: 457 },
      gap: 22,
      headingPadding: {
        top: scaleLinearly(heightScale, 26, 13),
        bottom: scaleLinearly(heightScale, 64, 42),
      },
      activeCardRaised: 32,
      buttonPadding: {
        top: scaleLinearly(heightScale, 38, 11),
        bottom: scaleLinearly(heightScale, 23, 16),
      },
    };
  }

  if (width >= 343 && height >= 612) {
    // For (390, 650) - (343, 612) = (47, 38) we will:
    // start
    // {
    //   itemSize: { width: 275, height: 419 },
    //   gap: 22,
    //   headingPadding: { top: 16, bottom: 56 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 30, bottom: 17 },
    // }
    //
    // width:
    //   |--------------------------------------------------------------|
    //   | location         | initial | end  | pixels saved | remaining |
    //   |                  |         |      |              | 47px      |
    //   | left card bleed  | 35px    | 12px | 23px         | 24px      |
    //   | right card bleed | 36px    | 12px | 24px         | 0         |
    //   |--------------------------------------------------------------|

    // height:
    //   |--------------------------------------------------------------|
    //   | location         | initial | end  | pixels saved | remaining |
    //   |                  |         |      |              | 38px      |
    //   | header top       | 16px    | 14px | 2px          | 36px      |
    //   | header bottom    | 56px    | 42px | 14px         | 22px      |
    //   | button top       | 30px    | 11px | 19px         | 3px       |
    //   | button bottom    | 17px    | 14px | 3px          | 0         |
    //   |--------------------------------------------------------------|

    const heightScale = { start: 650, end: 612, current: height };

    return {
      itemSize: { width: 275, height: 419 },
      gap: 22,
      headingPadding: {
        top: scaleLinearly(heightScale, 16, 14),
        bottom: scaleLinearly(heightScale, 56, 42),
      },
      activeCardRaised: 32,
      buttonPadding: {
        top: scaleLinearly(heightScale, 30, 11),
        bottom: scaleLinearly(heightScale, 17, 14),
      },
    };
  }

  if (width >= 343 && height < 612) {
    // for (390, 611) - (343, 0) = (47, 611) we will:
    // start
    // {
    //   itemSize: { width: 275, height: 419 },
    //   gap: 22,
    //   headingPadding: { top: 14, bottom: 42 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 11, bottom: 14 },
    // }
    // scale equally from all vertical locations to 0
    const heightScale = { start: 611 - 56 * 2, end: 0, current: height - 56 * 2 };
    return {
      itemSize: { width: 275, height: Math.floor(scaleLinearly(heightScale, 419, 0)) },
      gap: 22,
      headingPadding: {
        top: scaleLinearly(heightScale, 14, 0),
        bottom: scaleLinearly(heightScale, 42, 8),
      },
      activeCardRaised: scaleLinearly(heightScale, 32, 8),
      buttonPadding: {
        top: scaleLinearly(heightScale, 11, 0),
        bottom: scaleLinearly(heightScale, 14, 0),
      },
      journeyInfoTopPercentage: scaleLinearly(heightScale, 60, 20),
    };
  }

  if (width >= 312 && height >= 721) {
    // for (342, 844) - (312, 721) = (30, 123) we will:
    // start
    // {
    //   itemSize: { width: 256, height: 500 },
    //   gap: 24,
    //   headingPadding: { top: 38, bottom: 96 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 60, bottom: 38 },
    // }
    //
    // width:
    //   |--------------------------------------------------------------|
    //   | location         | initial | end  | pixels saved | remaining |
    //   |                  |         |      |              | 30px      |
    //   | left gap         | 24px    | 16px | 8px          | 22px      |
    //   | right gap        | 24px    | 16px | 8px          | 14px      |
    //   | left card bleed  | 19px    | 12px | 7px          | 7px       |
    //   | right card bleed | 19px    | 12px | 7px          | 0         |
    //   |--------------------------------------------------------------|

    // height:
    //   |-------------------------------------------------------------|
    //   | location        | initial | end  | pixels saved | remaining |
    //   |                 |         |      |              | 123px     |
    //   | header top      | 38px    | 24px | 14px         | 109px     |
    //   | header bottom   | 96px    | 48px | 48px         | 61px      |
    //   | button top      | 60px    | 12px | 48px         | 13px      |
    //   | button bottom   | 38px    | 25px | 13px         | 0         |
    //   |-------------------------------------------------------------|

    const heightScale = { start: 844, end: 721, current: height };
    const widthScale = { start: 342, end: 312, current: width };

    return {
      itemSize: { width: 256, height: 500 },
      gap: Math.floor(scaleLinearly(widthScale, 24, 16)),
      headingPadding: {
        top: scaleLinearly(heightScale, 38, 24),
        bottom: scaleLinearly(heightScale, 96, 48),
      },
      activeCardRaised: 32,
      buttonPadding: {
        top: scaleLinearly(heightScale, 60, 12),
        bottom: scaleLinearly(heightScale, 38, 25),
      },
    };
  }

  if (width >= 312 && height >= 651) {
    // for (342, 720) - (312, 651) = (30, 69) we will:
    // start
    // {
    //   itemSize: { width: 256, height: 457 },
    //   gap: 24,
    //   headingPadding: { top: 26, bottom: 64 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 38, bottom: 23 },
    // }
    //
    // width:
    //   |--------------------------------------------------------------|
    //   | location         | initial | end  | pixels saved | remaining |
    //   |                  |         |      |              | 30px      |
    //   | left gap         | 24px    | 16px | 8px          | 22px      |
    //   | right gap        | 24px    | 16px | 8px          | 14px      |
    //   | left card bleed  | 19px    | 12px | 7px          | 7px       |
    //   | right card bleed | 19px    | 12px | 7px          | 0         |
    //   |--------------------------------------------------------------|

    // height:
    //   |-------------------------------------------------------------|
    //   | location        | initial | end  | pixels saved | remaining |
    //   |                 |         |      |              | 69px      |
    //   | header top      | 26px    | 13px | 13px         | 56px      |
    //   | header bottom   | 64px    | 42px | 22px         | 34px      |
    //   | button top      | 38px    | 11px | 27px         | 7px       |
    //   | button bottom   | 23px    | 16px | 7px          | 0px       |
    //   |-------------------------------------------------------------|
    const heightScale = { start: 720, end: 651, current: height };
    const widthScale = { start: 342, end: 312, current: width };

    return {
      itemSize: { width: 256, height: 457 },
      gap: Math.floor(scaleLinearly(widthScale, 24, 16)),
      headingPadding: {
        top: scaleLinearly(heightScale, 26, 13),
        bottom: scaleLinearly(heightScale, 64, 42),
      },
      activeCardRaised: 32,
      buttonPadding: {
        top: scaleLinearly(heightScale, 38, 11),
        bottom: scaleLinearly(heightScale, 23, 16),
      },
    };
  }

  if (width >= 312 && height >= 612) {
    // for (342, 650) - (312, 612) = (30, 38) we will:
    // start
    // {
    //   itemSize: { width: 256, height: 419 },
    //   gap: 24,
    //   headingPadding: { top: 16, bottom: 56 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 30, bottom: 17 },
    // }
    //
    // width:
    //   |--------------------------------------------------------------|
    //   | location         | initial | end  | pixels saved | remaining |
    //   |                  |         |      |              | 30px      |
    //   | left gap         | 24px    | 16px | 8px          | 22px      |
    //   | right gap        | 24px    | 16px | 8px          | 14px      |
    //   | left card bleed  | 19px    | 12px | 7px          | 7px       |
    //   | right card bleed | 19px    | 12px | 7px          | 0         |
    //   |--------------------------------------------------------------|

    // height:
    //   |--------------------------------------------------------------|
    //   | location         | initial | end  | pixels saved | remaining |
    //   |                  |         |      |              | 38px      |
    //   | header top       | 16px    | 14px | 2px          | 36px      |
    //   | header bottom    | 56px    | 42px | 14px         | 22px      |
    //   | button top       | 30px    | 11px | 19px         | 3px       |
    //   | button bottom    | 17px    | 14px | 3px          | 0         |
    //   |--------------------------------------------------------------|
    const heightScale = { start: 650, end: 612, current: height };
    const widthScale = { start: 342, end: 312, current: width };

    return {
      itemSize: { width: 256, height: 419 },
      gap: Math.floor(scaleLinearly(widthScale, 24, 16)),
      headingPadding: {
        top: scaleLinearly(heightScale, 16, 14),
        bottom: scaleLinearly(heightScale, 56, 42),
      },
      activeCardRaised: 32, //Math.floor(scaleLinearly(heightScale, 32, 24)),
      buttonPadding: {
        top: scaleLinearly(heightScale, 30, 11),
        bottom: scaleLinearly(heightScale, 17, 14),
      },
    };
  }

  if (width >= 312 && height < 612) {
    // for (342, 611) - (312, 0) = (30, 611) we will:
    // start
    // {
    //   itemSize: { width: 256, height: 419 },
    //   gap: 16,
    //   headingPadding: { top: 14, bottom: 42 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 11, bottom: 14 },
    // }
    // scale equally from all vertical locations to 0
    const heightScale = { start: 611 - 56 * 2, end: 0, current: height - 56 * 2 };
    const widthScale = { start: 342, end: 312, current: width };
    return {
      itemSize: { width: 256, height: Math.floor(scaleLinearly(heightScale, 419, 0)) },
      gap: Math.floor(scaleLinearly(widthScale, 24, 16)),
      headingPadding: {
        top: scaleLinearly(heightScale, 14, 0),
        bottom: scaleLinearly(heightScale, 42, 8),
      },
      activeCardRaised: scaleLinearly(heightScale, 32, 8),
      buttonPadding: {
        top: scaleLinearly(heightScale, 11, 0),
        bottom: scaleLinearly(heightScale, 14, 0),
      },
      journeyInfoTopPercentage: scaleLinearly(heightScale, 60, 20),
    };
  }

  if (height >= 721) {
    // for (311, 844) - (0, 721) = (311, 123) we will:
    // start
    // {
    //   itemSize: { width: 256, height: 500 },
    //   gap: 16,
    //   headingPadding: { top: 38, bottom: 96 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 60, bottom: 38 },
    // }
    // scale equally from all horizontal locations to 0
    const heightScale = { start: 844, end: 721, current: height };
    const widthScale = { start: 311, end: 0, current: width };

    return {
      itemSize: { width: Math.floor(scaleLinearly(widthScale, 256, 0)), height: 500 },
      gap: Math.floor(scaleLinearly(widthScale, 16, 0)),
      headingPadding: {
        top: scaleLinearly(heightScale, 38, 24),
        bottom: scaleLinearly(heightScale, 96, 48),
      },
      activeCardRaised: 32,
      buttonPadding: {
        top: scaleLinearly(heightScale, 60, 12),
        bottom: scaleLinearly(heightScale, 38, 25),
      },
    };
  }

  if (height >= 651) {
    // for (311, 720) - (0, 651) = (311, 69) we will:
    // start
    // {
    //   itemSize: { width: 256, height: 457 },
    //   gap: 16,
    //   headingPadding: { top: 26, bottom: 64 },
    //   activeCardRaised: 32,
    //   buttonPadding: { top: 38, bottom: 23 },
    // }
    const heightScale = { start: 720, end: 651, current: height };
    const widthScale = { start: 311, end: 0, current: width };

    return {
      itemSize: { width: Math.floor(scaleLinearly(widthScale, 256, 0)), height: 457 },
      gap: Math.floor(scaleLinearly(widthScale, 16, 0)),
      headingPadding: {
        top: scaleLinearly(heightScale, 26, 13),
        bottom: scaleLinearly(heightScale, 64, 42),
      },
      activeCardRaised: 32,
      buttonPadding: {
        top: scaleLinearly(heightScale, 38, 11),
        bottom: scaleLinearly(heightScale, 23, 16),
      },
    };
  }

  // for (311, 650) - (0, 0) = (311, 650) we will:
  // scale equally from all vertical locations to 0
  // scale equally from all horizontal locations to 0
  // start:
  // {
  //   itemSize: { width: 256, height: 457 },
  //   gap: 16,
  //   headingPadding: { top: 14, bottom: 42 },
  //   activeCardRaised: 32,
  //   buttonPadding: { top: 11, bottom: 14 },
  // }
  const heightScale = { start: 650, end: 0, current: height };
  const widthScale = { start: 311, end: 0, current: width };
  return {
    itemSize: {
      width: Math.floor(scaleLinearly(widthScale, 256, 0)),
      height: Math.floor(scaleLinearly(heightScale, 419, 0)),
    },
    gap: Math.floor(scaleLinearly(widthScale, 16, 0)),
    headingPadding: {
      top: scaleLinearly(heightScale, 14, 0),
      bottom: scaleLinearly(heightScale, 42, 8),
    },
    activeCardRaised: scaleLinearly(heightScale, 32, 8),
    buttonPadding: {
      top: scaleLinearly(heightScale, 11, 0),
      bottom: scaleLinearly(heightScale, 14, 0),
    },
    journeyInfoTopPercentage: scaleLinearly(heightScale, 60, 20),
  };
};

function scaleLinearly(
  scaleOn: { start: number; end: number; current: number },
  start: number,
  end: number
) {
  const progress = (scaleOn.current - scaleOn.start) / (scaleOn.end - scaleOn.start);
  return start + (end - start) * progress;
}
