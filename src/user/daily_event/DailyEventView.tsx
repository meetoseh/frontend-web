import { ReactElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../shared/forms/Button';
import { LoginContext } from '../../shared/LoginContext';
import { MyProfilePicture } from '../../shared/MyProfilePicture';
import { OsehImage } from '../../shared/OsehImage';
import { DailyEvent } from './DailyEvent';
import styles from './DailyEventView.module.css';
import assistiveStyles from '../../shared/assistive.module.css';
import { JourneyRef } from '../journey/Journey';
import { apiFetch } from '../../shared/ApiConstants';
import { describeErrorFromResponse, ErrorBlock } from '../../shared/forms/ErrorBlock';

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
 * Shows the specified daily event and allows the user to take actions as
 * appropriate for the indicated access level
 */
export const DailyEventView = ({
  event,
  setLoading,
  setJourney,
}: DailyEventViewProps): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [loadedImagesByUID, setLoadedImagesByUID] = useState<{ [uid: string]: boolean }>({});
  const [carouselOrder, setCarouselOrder] = useState<number[]>([]);
  const [activeJourney, setActiveJourney] = useState<string>('');
  const [carouselTargetTransformX, setCarouselTargetTransformX] = useState<number>(0);
  const [carouselTransformX, setCarouselTransformX] = useState<number>(0);
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
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
    const newCarouselOrder = event.journeys
      .map((_, i) => ({ i, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((o) => o.i);

    setCarouselOrder(newCarouselOrder);
    setActiveJourney(
      event.journeys.length > 0
        ? event.journeys[newCarouselOrder[Math.floor(newCarouselOrder.length / 2)]].uid
        : ''
    );
  }, [event.journeys]);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;

    const handler = () => {
      timeout = null;
      setWindowWidth(window.innerWidth);
    };

    const listener = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(handler, 250);
    };

    window.addEventListener('resize', listener);

    return () => {
      window.removeEventListener('resize', listener);
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    };
  });

  const onImageSetLoading = useCallback((loading: boolean, uid: string) => {
    setLoadedImagesByUID((u) => ({
      ...u,
      [uid]: !loading,
    }));
  }, []);

  const calculateTransformForIndex = useCallback(
    (idx: number) => {
      const itemWidth = 264;
      const itemGutter = 20;

      const carouselWidth =
        itemWidth * event.journeys.length + itemGutter * (event.journeys.length - 1);
      const offsetOfFirstIndexWithNoTransform = windowWidth / 2 - carouselWidth / 2;
      const activeIndexDesiredOffset = windowWidth / 2 - itemWidth / 2;

      const idxOffsetWithNoTransform =
        offsetOfFirstIndexWithNoTransform + idx * (itemWidth + itemGutter);
      return activeIndexDesiredOffset - idxOffsetWithNoTransform;
    },
    [windowWidth, event.journeys.length]
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
    const itemWidth = 264;
    const itemGutter = 20;

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
      const journey: JourneyRef = {
        uid: data.uid,
        sessionUid: data.session_uid,
        jwt: data.jwt,
        durationSeconds: data.duration_seconds,
        backgroundImage: data.background_image,
        audioContent: data.audio_content,
        category: {
          externalName: data.category.external_name,
        },
        title: data.title,
        instructor: data.instructor,
        description: data.description,
        prompt: data.prompt,
      };
      setJourney(journey);
    } catch (e) {
      console.error(e);
      if (e instanceof TypeError) {
        setError(<>Failed to connect to server. Check your internet connection.</>);
      } else if (e instanceof Response) {
        setError(await describeErrorFromResponse(e));
      } else {
        setError(<>Unknown error. Contact support.</>);
      }
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
        const journey: JourneyRef = {
          uid: data.uid,
          sessionUid: data.session_uid,
          jwt: data.jwt,
          durationSeconds: data.duration_seconds,
          backgroundImage: data.background_image,
          audioContent: data.audio_content,
          category: {
            externalName: data.category.external_name,
          },
          title: data.title,
          instructor: data.instructor,
          description: data.description,
          prompt: data.prompt,
        };
        setJourney(journey);
      } catch (e) {
        console.error(e);
        if (e instanceof TypeError) {
          setError(<>Failed to connect to server. Check your internet connection.</>);
        } else if (e instanceof Response) {
          setError(await describeErrorFromResponse(e));
        } else {
          setError(<>Unknown error. Contact support.</>);
        }
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

  if (loginContext.state !== 'logged-in') {
    return <></>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <div className={styles.headerContainer}>
          <div
            className={styles.headerProfileContainer}
            style={profilePictureAvailable ? {} : { display: 'none' }}>
            <MyProfilePicture
              displayWidth={48}
              displayHeight={48}
              setAvailable={setProfilePictureAvailable}
            />
          </div>
          <div className={styles.headerTextContainer}>
            <div className={styles.subheader}>Hi {loginContext.userAttributes?.name ?? ''} 👋</div>
            <div className={styles.header}>Choose today's journey</div>
          </div>
        </div>

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
            style={{ transform: `translateX(${carouselTransformX}px)` }}>
            {carouselOrder
              .map((i) => [event.journeys[i], i] as const)
              .map(([journey, i]) => {
                const inner = (
                  <>
                    <div className={styles.journeyImageContainer}>
                      <OsehImage
                        uid={journey.backgroundImage.uid}
                        jwt={journey.backgroundImage.jwt}
                        displayWidth={264}
                        displayHeight={446}
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

                    <div className={styles.journeyInfoContainer}>
                      <div className={styles.journeyTitle}>{journey.title}</div>
                      <div className={styles.journeyInstructor}>{journey.instructor.name}</div>
                      <div className={styles.journeyDescription}>{journey.description.text}</div>
                    </div>
                  </>
                );

                if (!journey.access.start) {
                  return (
                    <a
                      href="/upgrade"
                      className={`${styles.journeyContainer} ${
                        journey.uid === activeJourney ? styles.active : styles.inactive
                      }`}
                      key={journey.uid}>
                      {inner}
                    </a>
                  );
                }

                return (
                  <button
                    className={`${styles.journeyContainer} ${
                      journey.uid === activeJourney ? styles.active : styles.inactive
                    }`}
                    onClick={boundOnChooseSpecific[i]}
                    disabled={startingJourney}
                    key={journey.uid}>
                    {inner}
                  </button>
                );
              })}
          </div>
        </div>

        <div className={styles.chooseForMeContainer}>
          {error && <ErrorBlock>{error}</ErrorBlock>}
          <Button
            type="button"
            variant="filled"
            disabled={!event.access.startRandom || startingJourney}
            onClick={onChooseForMe}>
            {event.journeys.some((j) => j.access.start) ? 'Choose For Me' : 'Start Your Free Class'}
          </Button>
        </div>
      </div>
    </div>
  );
};
