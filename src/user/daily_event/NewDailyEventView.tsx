import {
  CSSProperties,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFullHeightStyle } from '../../shared/hooks/useFullHeight';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { shuffle } from '../../shared/lib/shuffle';
import { useOsehImageStates } from '../../shared/OsehImage';
import { JourneyRef } from '../journey/models/JourneyRef';
import { DailyEvent } from './DailyEvent';
import { DailyEventJourneyCard } from './DailyEventJourneyCard';
import styles from './NewDailyEventView.module.css';

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
 * Shows the specified daily event and allows the user to take actions as
 * appropriate for the indicated access level
 */
export const DailyEventView = ({
  event,
  setLoading,
  setJourney,
}: DailyEventViewProps): ReactElement => {
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

  const renderedAnimatingToward = useRef<'left' | 'right' | null>(animatingToward);
  const renderedAnimatingTowardCard = useRef<ReactElement | null>(null);
  const renderedActiveContainerStyle = useRef<CSSProperties>(activeContainerStyle);
  const renderedForcedCard = useRef<ReactElement | null>(forcedCard);
  const renderedCarouselOrder = useRef<CarouselOrder | null>(null);
  const rerenderCallbacks = useRef<(() => void)[]>([]);

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
   * We're loading while any journeys are loading or the carousel order
   * hasn't been selected yet
   */
  useEffect(() => {
    setLoading(cardBackgrounds.some((i) => i.loading) || carouselOrderIsNull);
  }, [setLoading, cardBackgrounds, carouselOrderIsNull]);

  /**
   * The cards that we are showing in the order of the original event.
   */
  const cards: ReactElement[] = useMemo(() => {
    return event.journeys.map((j, idx) => {
      return (
        <DailyEventJourneyCard
          journey={j}
          windowSize={windowSize}
          background={cardBackgrounds[idx]}
        />
      );
    });
  }, [event.journeys, cardBackgrounds, windowSize]);

  /**
   * Whenever the cards change, we need to update the carousel order
   */
  useEffect(() => {
    const order: number[] = [];
    for (let i = 0; i < cards.length; i++) {
      order.push(i);
    }
    shuffle(order);

    const cardsInOrder = order.map((i) => cards[i]);
    setCarouselOrder({ indices: order, cards: cardsInOrder });
  }, [cards]);

  const transitionLock = useRef(false);

  const handleTransition = useCallback(
    async (dir: 'left' | 'right', transform: string, rotateOrder: () => void) => {
      if (transitionLock.current) {
        return;
      }

      transitionLock.current = true;
      try {
        await doTransitionLeft();
      } finally {
        transitionLock.current = false;
      }

      async function doTransitionLeft() {
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

      /**
       * Waits 1 rerender at a time until the predicate is true, then resolves
       */
      function waitUntil(pred: () => boolean): Promise<void> {
        return new Promise<void>((resolve) => {
          const onRerender = () => {
            if (pred()) {
              requestAnimationFrame(() => resolve());
              return;
            }

            rerenderCallbacks.current.push(onRerender);
          };

          rerenderCallbacks.current.push(onRerender);
        });
      }
    },
    [fullHeightStyle]
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
   * Handles arrow keys for navigating the carousel. Uses CSS transition
   * for animating which is often gpu-accelerated.
   */
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    let active = true;
    window.addEventListener('keydown', onKeyDown);
    return () => {
      active = false;
      window.removeEventListener('keydown', onKeyDown);
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
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
  }, [transitionLeft, transitionRight]);

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

  if (forcedCard !== null) {
    return (
      <div className={styles.container} style={fullHeightStyle}>
        <div className={styles.currentContainer} style={fullHeightStyle}>
          {forcedCard}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} style={fullHeightStyle}>
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
