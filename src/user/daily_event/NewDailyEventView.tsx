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
import TinyGesture from 'tinygesture';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import { apiFetch } from '../../shared/ApiConstants';
import { FullscreenContext } from '../../shared/FullscreenContext';
import { useFullHeightStyle } from '../../shared/hooks/useFullHeight';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { shuffle } from '../../shared/lib/shuffle';
import { LoginContext } from '../../shared/LoginContext';
import { useMyProfilePictureState } from '../../shared/MyProfilePicture';
import { useOsehImageStates } from '../../shared/OsehImage';
import { JourneyRef, journeyRefKeyMap } from '../journey/models/JourneyRef';
import { DailyEvent, DailyEventJourney } from './DailyEvent';
import { DailyEventJourneyCard } from './DailyEventJourneyCard';
import styles from './NewDailyEventView.module.css';
import assistiveStyles from '../../shared/assistive.module.css';

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

type CarouselOrder = {
  indices: number[];
  cards: ReactElement[];
};

const TRANSITION_TIME_MS = 500;

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
  const windowSize = useWindowSize();
  const [animatingToward, setAnimatingToward] = useState<'left' | 'right' | null>(null);
  const fullHeightStyle = useFullHeightStyle({ attribute: 'height', windowSize });
  const [activeContainerStyle, setActiveContainerStyle] = useState<CSSProperties>(() =>
    Object.assign({}, fullHeightStyle)
  );
  const [forcedCard, setForcedCard] = useState<ReactElement | null>(null);
  const cardBackgroundProps = useMemo(
    () =>
      event.journeys.map((j) => ({
        uid: j.backgroundImage.uid,
        jwt: j.backgroundImage.jwt,
        displayWidth: windowSize.width,
        displayHeight: windowSize.height,
        alt: '',
      })),
    [event.journeys, windowSize.width, windowSize.height]
  );
  const cardBackgrounds = useOsehImageStates(cardBackgroundProps);
  const profilePicture = useMyProfilePictureState({
    loginContext,
    displayWidth: 48,
    displayHeight: 48,
  });

  const renderedAnimatingToward = useRef<'left' | 'right' | null>(animatingToward);
  const renderedAnimatingTowardCard = useRef<ReactElement | null>(null);
  const renderedActiveContainerStyle = useRef<CSSProperties>(activeContainerStyle);
  const renderedForcedCard = useRef<ReactElement | null>(forcedCard);
  const renderedCarouselOrder = useRef<CarouselOrder | null>(null);
  const rerenderCallbacks = useRef<(() => void)[]>([]);
  const [seenSwipe, setSeenSwipe] = useState(() => {
    return localStorage.getItem('daily_event-NewDailyEventView-seenSwipe') === 'true';
  });
  const [teachingSwipe, setTeachingSwipe] = useState<'behind-left' | 'behind-right' | false>(false);

  const originalShuffle: number[] = useMemo(
    () => createJourneyShuffle(event.journeys),
    [event.journeys]
  );

  /**
   * The cards arranged in carousel order. It would be preferable to split
   * this into two values - one with the order and one with the cards - but
   * then it's very difficult to avoid a single rerender with the wrong
   * carousel order after animating a transition, which causing a very
   * noticeable flicker.
   */
  const [carouselOrder, setCarouselOrder] = useState<CarouselOrder | null>(null);

  const carouselOrderIsNull = carouselOrder === null;
  /**
   * We're loading while any journeys are loading, the carousel order
   * hasn't been selected yet, or the profile picture is loading
   */
  useEffect(() => {
    setLoading(
      cardBackgrounds.some((i) => i.loading) ||
        carouselOrderIsNull ||
        profilePicture.state === 'loading'
    );
  }, [setLoading, cardBackgrounds, carouselOrderIsNull, profilePicture.state]);

  const onPlay = useCallback(
    async (journey: DailyEventJourney) => {
      const response = await apiFetch(
        '/api/1/daily_events/start_specific',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            daily_event_uid: event.uid,
            daily_event_jwt: event.jwt,
            journey_uid: journey.uid,
          }),
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const dataRaw = await response.json();
      const data = convertUsingKeymap(dataRaw, journeyRefKeyMap);
      setJourney(data);
    },
    [setJourney, loginContext, event.uid, event.jwt]
  );

  const onStartRandom: ((this: void) => Promise<void>) | null = useMemo(() => {
    if (!event.access.startRandom) {
      return null;
    }

    return async () => {
      const response = await apiFetch(
        '/api/1/daily_events/start_random',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
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

      const dataRaw = await response.json();
      const data = convertUsingKeymap(dataRaw, journeyRefKeyMap);
      setJourney(data);
    };
  }, [loginContext, setJourney, event.access.startRandom, event.uid, event.jwt]);

  /**
   * The cards that we are showing in the order of the original event.
   */
  const cards: ReactElement[] = useMemo(() => {
    const originalIdxToShuffleIdx = new Map<number, number>();
    for (let i = 0; i < originalShuffle.length; i++) {
      originalIdxToShuffleIdx.set(originalShuffle[i], i);
    }

    return event.journeys.map((j, idx) => {
      return (
        <DailyEventJourneyCard
          loginContext={loginContext}
          journey={j}
          windowSize={windowSize}
          background={cardBackgrounds[idx]}
          profilePicture={profilePicture}
          numberOfJourneys={event.journeys.length}
          journeyIndex={originalIdxToShuffleIdx.get(idx)!}
          startRandom={onStartRandom}
          onPlay={onPlay}
        />
      );
    });
  }, [
    event.journeys,
    onStartRandom,
    cardBackgrounds,
    windowSize,
    profilePicture,
    loginContext,
    originalShuffle,
    onPlay,
  ]);

  /**
   * Whenever the cards change, we need to update the carousel order
   */
  useEffect(() => {
    const order: number[] = originalShuffle;

    const cardsInOrder = order.map((i) => cards[i]);
    setCarouselOrder({ indices: order, cards: cardsInOrder });
  }, [originalShuffle, cards]);

  const transitionLock = useRef(false);

  /**
   * Waits until the predicate is true, checking once per render
   */
  const waitUntil = useCallback((pred: () => boolean): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      let active = true;
      const timeout = setTimeout(() => {
        if (!active) {
          return;
        }

        active = false;
        console.log('bad waitUntil predicate:', pred, '; is now true? ', pred());
        reject('Timed out waiting for predicate to be true');
      }, 1000);
      const onRerender = () => {
        if (!active) {
          return;
        }

        if (pred()) {
          clearTimeout(timeout);
          active = false;
          requestAnimationFrame(() => resolve());
          return;
        }

        rerenderCallbacks.current.push(onRerender);
      };

      rerenderCallbacks.current.push(onRerender);
    });
  }, []);

  const handleTransition = useCallback(
    async (dir: 'left' | 'right', transform: string, rotateOrder: () => void) => {
      if (transitionLock.current) {
        return;
      }
      setSeenSwipe(true);
      localStorage.setItem('daily_event-NewDailyEventView-seenSwipe', 'true');

      transitionLock.current = true;
      try {
        await doTransition();
      } finally {
        transitionLock.current = false;
      }

      async function doTransition() {
        setAnimatingToward(dir);
        setActiveContainerStyle(
          Object.assign({}, fullHeightStyle, {
            transition: `transform ${TRANSITION_TIME_MS}ms ease-in`,
          })
        );
        await waitUntil(() => renderedAnimatingToward.current === dir);
        setActiveContainerStyle(
          Object.assign({}, fullHeightStyle, {
            transition: `transform ${TRANSITION_TIME_MS}ms ease-in`,
            transformOrigin: 'bottom center',
            transform,
          })
        );
        await waitUntil(() => !!renderedActiveContainerStyle.current.transform);
        await new Promise((resolve) => setTimeout(resolve, TRANSITION_TIME_MS));
        setForcedCard(renderedAnimatingTowardCard.current);
        await waitUntil(() => renderedForcedCard.current !== null);
        setActiveContainerStyle(Object.assign({}, fullHeightStyle));
        await waitUntil(() => !renderedActiveContainerStyle.current.transform);
        setAnimatingToward(null);
        await waitUntil(() => renderedAnimatingToward.current === null);
        rotateOrder();
        await waitUntil(
          () => renderedCarouselOrder.current?.cards[0] === renderedForcedCard.current
        );
        setForcedCard(null);
        await waitUntil(() => renderedForcedCard.current === null);
      }
    },
    [fullHeightStyle, waitUntil]
  );

  /**
   * Transitions the carousel to the left, i.e., at the end of this process
   * the last card is moved to the front and the front card is at index 1.
   */
  const transitionLeft = useCallback(async () => {
    handleTransition('left', 'rotateZ(-45deg) translateX(-100%) scale(33%)', () => {
      setCarouselOrder((o) => {
        if (o === null) {
          return null;
        }

        const newIndices = o.indices.slice();
        newIndices.unshift(newIndices.pop()!);

        const newCards = o.cards.slice();
        newCards.unshift(newCards.pop()!);

        return { indices: newIndices, cards: newCards };
      });
    });
  }, [handleTransition]);

  const transitionRight = useCallback(async () => {
    handleTransition('right', 'rotateZ(45deg) translateX(100%) scale(33%)', () => {
      setCarouselOrder((o) => {
        if (o === null) {
          return null;
        }

        const newIndices = o.indices.slice();
        newIndices.push(newIndices.shift()!);

        const newCards = o.cards.slice();
        newCards.push(newCards.shift()!);

        return { indices: newIndices, cards: newCards };
      });
    });
  }, [handleTransition]);

  /**
   * Handles arrow keys/scroll wheel for navigating the carousel. Uses CSS
   * transition for animating which is often gpu-accelerated.
   */
  useEffect(() => {
    let active = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel);
    return () => {
      active = false;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };

    function onKeyDown(event: KeyboardEvent) {
      if (!active) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        transitionLeft();
      } else if (event.key === 'ArrowRight') {
        transitionRight();
      }
    }

    function onWheel(event: WheelEvent) {
      if (!active) {
        return;
      }

      if (event.deltaX === 0 && event.deltaY === 0) {
        return;
      }

      if (event.deltaX < 0 || (event.deltaX === 0 && event.deltaY < 0)) {
        transitionLeft();
      } else {
        transitionRight();
      }
    }
  }, [transitionLeft, transitionRight]);

  const teachingSwipeRef = useRef(teachingSwipe);
  teachingSwipeRef.current = teachingSwipe;

  // Handles gestures for navigating the carousel. Uses javascript for panning
  // and CSS transition when the gesture is complete.
  useEffect(() => {
    const gesture = new TinyGesture(document.body);

    let rerenderHandler: (() => void) | null = null;

    const onNextRender = (cb: () => void) => {
      if (rerenderHandler !== null) {
        rerenderHandler = cb;
        return;
      }

      rerenderHandler = cb;
      requestAnimationFrame(() => {
        if (!active) {
          return;
        }

        const handler = rerenderHandler;
        rerenderHandler = null;
        if (handler !== null) {
          handler();
        }
      });
    };

    const withTransitionLockIfImmediatelyAvailable = async (cb: () => void | Promise<void>) => {
      if (transitionLock.current) {
        return;
      }

      transitionLock.current = true;
      try {
        await cb();
      } finally {
        transitionLock.current = false;
      }
    };

    let active = true;
    gesture.on('panmove', () => {
      if (teachingSwipeRef.current) {
        setTeachingSwipe(false);
      }
      onNextRender(() => {
        if (
          gesture.swipingDirection === 'horizontal' &&
          gesture.touchMoveX !== null &&
          gesture.touchMoveX !== 0
        ) {
          if (gesture.touchMoveX < 0) {
            transitionLeft();
          } else {
            transitionRight();
          }
          return;
        }

        if (
          gesture.swipingDirection === 'pre-horizontal' &&
          gesture.touchMoveX !== null &&
          gesture.touchMoveX !== 0
        ) {
          const moveX = gesture.touchMoveX;
          withTransitionLockIfImmediatelyAvailable(async () => {
            setAnimatingToward(moveX < 0 ? 'left' : 'right');
            const newTransform = `translateX(${moveX}px)`;
            setActiveContainerStyle(
              Object.assign({}, fullHeightStyle, { transform: newTransform })
            );
            await waitUntil(() => renderedActiveContainerStyle.current.transform === newTransform);
          });
        }
      });
    });
    gesture.on('panend', () => {
      onNextRender(() => {
        withTransitionLockIfImmediatelyAvailable(async () => {
          setActiveContainerStyle(
            Object.assign({}, renderedActiveContainerStyle.current, {
              transition: 'transform 0.35s ease-in-out',
            })
          );
          await waitUntil(() => !!renderedActiveContainerStyle.current.transition);
          setActiveContainerStyle(
            Object.assign({}, fullHeightStyle, { transition: 'transform: 0.35s ease-in-out' })
          );

          await waitUntil(() => !renderedActiveContainerStyle.current.transform);
          await new Promise((resolve) => setTimeout(resolve, 350));
          setAnimatingToward(null);
          setActiveContainerStyle(fullHeightStyle);
          await waitUntil(
            () =>
              !renderedActiveContainerStyle.current.transition &&
              renderedAnimatingToward.current === null
          );
        });
      });
    });
    return () => {
      rerenderHandler = null;
      gesture.destroy();
    };
  }, [transitionLeft, transitionRight, fullHeightStyle, waitUntil]);

  // Turns on teachingSwipe for 2s every 30s until they swipe, starting after 2s
  useEffect(() => {
    if (seenSwipe) {
      return;
    }

    let active = true;
    let timeout: NodeJS.Timeout = setTimeout(teach, 2000);
    setTeachingSwipe(false);
    return () => {
      active = false;
      clearTimeout(timeout);
    };

    function teach() {
      if (!active) {
        return;
      }

      setTeachingSwipe('behind-right');
      timeout = setTimeout(switchToBehindLeft, 1000);
    }

    function switchToBehindLeft() {
      if (!active) {
        return;
      }

      setTeachingSwipe('behind-left');
      timeout = setTimeout(stopTeaching, 1000);
    }

    function stopTeaching() {
      if (!active) {
        return;
      }

      setTeachingSwipe(false);
      setTimeout(teach, 30000);
    }
  }, [seenSwipe]);

  if (carouselOrder === null) {
    return <></>;
  }

  renderedAnimatingToward.current = animatingToward;
  renderedActiveContainerStyle.current = activeContainerStyle;
  renderedForcedCard.current = forcedCard;
  renderedAnimatingTowardCard.current =
    animatingToward === null
      ? null
      : animatingToward === 'left'
      ? carouselOrder.cards[carouselOrder.cards.length - 1]
      : carouselOrder.cards[1];
  renderedCarouselOrder.current = carouselOrder;
  const cpRerenderCallbacks = rerenderCallbacks.current;
  rerenderCallbacks.current = [];
  cpRerenderCallbacks.forEach((cb) => cb());

  if (teachingSwipe) {
    return (
      <div className={styles.container} style={fullHeightStyle}>
        <div className={styles.nextContainer}>
          {carouselOrder.cards[carouselOrder.cards.length - 1]}
        </div>
        {teachingSwipe === 'behind-left' && (
          <div className={styles.nextContainer}>
            {carouselOrder.cards[carouselOrder.cards.length - 1]}
          </div>
        )}
        {teachingSwipe === 'behind-right' && (
          <div className={styles.nextContainer}>{carouselOrder.cards[1]}</div>
        )}
        <div
          className={`${styles.currentContainer} ${styles.teachingSwipe}`}
          style={activeContainerStyle}>
          {carouselOrder.cards[0]}
        </div>
      </div>
    );
  }

  if (forcedCard !== null) {
    return (
      <div className={styles.container} style={fullHeightStyle}>
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
        <div className={styles.currentContainer} style={fullHeightStyle}>
          {forcedCard}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} style={fullHeightStyle}>
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

      {animatingToward === 'left' && (
        <div className={styles.nextContainer}>
          {carouselOrder.cards[carouselOrder.cards.length - 1]}
        </div>
      )}
      {animatingToward === 'right' && (
        <div className={styles.nextContainer}>{carouselOrder.cards[1]}</div>
      )}
      <div className={styles.currentContainer} style={activeContainerStyle}>
        {carouselOrder.cards[0]}
      </div>
    </div>
  );
};
