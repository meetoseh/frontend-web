import {
  Dispatch,
  ReactElement,
  RefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContextValue } from '../../../shared/LoginContext';
import { JourneyTime } from '../hooks/useJourneyTime';
import { JourneyPromptProps } from '../models/JourneyPromptProps';
import '../../../assets/fonts.css';
import styles from './NumericJourneyPrompt.module.css';

type FakedMove = {
  /**
   * The index of the prompt option we are lowering the selection of by
   * 1
   */
  fromIndex: number;

  /**
   * The maximum value we should assume for the fromIndex; if the actual
   * value from the stats endpoint dips below this value, ignore this part
   * of the faked move
   */
  maxFromActive: number;

  /**
   * The index of the prompt option we are increasing the selection of by
   * 1
   */
  toIndex: number;

  /**
   * The minimum value we shoul assume for the toIndex; if the actual
   * value from the stats endpoint goes above this value, drop the faked
   * move early
   */
  minToActive: number;

  /**
   * The journey time at which we should stop faking the move
   */
  endsAt: number;
};

/**
 * Renders a numeric style prompt using a horizontal carousel for the user to
 * select their response, where below each response in the carousel is a
 * rectangle whose height and color represents the percentage of users who have
 * selected that response. The users active response has slightly more opacity
 * than the others.
 */
export const NumericJourneyPrompt = ({
  journeyUid,
  journeyJwt,
  sessionUid,
  prompt,
  journeyDurationSeconds,
  stats,
  journeyTime,
  loginContext,
}: JourneyPromptProps): ReactElement => {
  if (prompt.style !== 'numeric') {
    throw new Error('Invalid prompt style');
  }

  // we want changing our answer to immediately react, but stats won't come in
  // for a second or so, so we alter the stats temporarily
  const [fakingMove, setFakingMove] = useState<FakedMove | null>(null);

  const promptOptions = useMemo(() => {
    const result: number[] = [];
    for (let i = prompt.min; i <= prompt.max; i += prompt.step) {
      result.push(i);
    }
    return result;
  }, [prompt.min, prompt.max, prompt.step]);

  const activeAfterFakingMove = useMemo(() => {
    if (fakingMove === null) {
      return stats.numericActive;
    }

    const active = new Map<number, number>(stats.numericActive);

    if (stats.numericActive === null) {
      for (const opt of promptOptions) {
        active.set(opt, 0);
      }
      return active;
    }

    active.set(
      promptOptions[fakingMove.fromIndex],
      Math.min(fakingMove.maxFromActive, active.get(promptOptions[fakingMove.fromIndex]) ?? 0)
    );
    active.set(
      promptOptions[fakingMove.toIndex],
      Math.max(fakingMove.minToActive, active.get(promptOptions[fakingMove.toIndex]) ?? 0)
    );
    return active;
  }, [promptOptions, stats.numericActive, fakingMove]);

  const [promptSelection, setPromptSelection] = useState(
    promptOptions[Math.floor(promptOptions.length / 2)]
  );
  const promptSelectionIndex = useMemo(() => {
    return promptOptions.indexOf(promptSelection);
  }, [promptSelection, promptOptions]);
  const setPromptSelectionIndex = useCallback(
    (idx: number) => {
      if (promptSelection !== promptOptions[idx]) {
        setFakingMove({
          fromIndex: promptSelectionIndex,
          maxFromActive: Math.max((activeAfterFakingMove?.get(promptSelection) ?? 0) - 1, 0),
          toIndex: idx,
          minToActive: (activeAfterFakingMove?.get(promptOptions[idx]) ?? 0) + 1,
          endsAt: journeyTime.time.current + 2500,
        });
        setPromptSelection(promptOptions[idx]);
      }
    },
    [promptOptions, promptSelection, journeyTime.time, activeAfterFakingMove, promptSelectionIndex]
  );
  useEffect(() => {
    if (fakingMove === null) {
      return;
    }

    if (fakingMove.endsAt <= journeyTime.time.current) {
      setFakingMove(null);
      return;
    }

    let active = true;
    const onTimeChanged = (lastTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (!active) {
        return;
      }
      if (newTime >= fakingMove.endsAt) {
        setFakingMove(null);
        unmount();
        return;
      }
    };

    const expectedIndex = journeyTime.onTimeChanged.current.length;
    journeyTime.onTimeChanged.current.push(onTimeChanged);

    const unmount = () => {
      if (!active) {
        return;
      }
      active = false;
      for (
        let i = Math.min(expectedIndex, journeyTime.onTimeChanged.current.length - 1);
        i >= 0;
        i--
      ) {
        if (journeyTime.onTimeChanged.current[i] === onTimeChanged) {
          journeyTime.onTimeChanged.current.splice(i, 1);
          break;
        }
      }
    };

    return unmount;
  }, [fakingMove, journeyTime.onTimeChanged, journeyTime.time]);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  usePromptSelectionEvents(
    journeyUid,
    journeyJwt,
    sessionUid,
    promptSelection,
    journeyDurationSeconds,
    journeyTime,
    loginContext
  );
  const carouselTransform = useCarouselTransform({
    inactiveItemWidth: 75,
    activeItemWidth: 75,
    inactiveInactiveGap: 20,
    inactiveActiveGap: 20,
    numItems: promptOptions.length,
    activeItemIndex: promptSelectionIndex,
    carouselRef: carouselRef,
    defaultCarouselWidth: Math.min(window.innerWidth, 440),
    setActiveItemIndex: setPromptSelectionIndex,
  });
  const averageMood = useMemo(() => {
    if (activeAfterFakingMove === null) {
      return promptOptions[Math.floor(promptOptions.length / 2)];
    }

    let totalResponses = 0;
    let sumResponses = 0;
    const iter = activeAfterFakingMove.entries();
    let next = iter.next();
    while (!next.done) {
      const [option, count] = next.value;
      totalResponses += count;
      sumResponses += option * count;
      next = iter.next();
    }

    if (totalResponses === 0) {
      return promptOptions[Math.floor(promptOptions.length / 2)];
    }

    return sumResponses / totalResponses;
  }, [activeAfterFakingMove, promptOptions]);
  const percentagesByOption = useMemo(() => {
    const percentagesByOption = new Map<number, number>();
    if (activeAfterFakingMove === null) {
      for (const opt of promptOptions) {
        percentagesByOption.set(opt, 0);
      }
      percentagesByOption.set(promptOptions[Math.floor(promptOptions.length / 2)], 100);
      return percentagesByOption;
    }

    let responsesByOption = [];
    for (const opt of promptOptions) {
      responsesByOption.push([opt, activeAfterFakingMove.get(opt) ?? 0]);
    }

    const totalResponses = responsesByOption.reduce((acc, [_, count]) => acc + count, 0);

    for (const [opt, count] of responsesByOption) {
      percentagesByOption.set(opt, totalResponses === 0 ? 0 : (count / totalResponses) * 100);
    }
    if (totalResponses === 0) {
      percentagesByOption.set(promptOptions[Math.floor(promptOptions.length / 2)], 100);
    }
    return percentagesByOption;
  }, [promptOptions, activeAfterFakingMove]);

  const carouselOptions = useMemo(() => {
    return promptOptions.map((option, optionIndex) => (
      <button
        key={option}
        className={`${styles.carouselItem} ${
          option === promptSelection ? styles.activeCarouselItem : ''
        }`}
        onClick={() => setPromptSelectionIndex(optionIndex)}>
        <div
          className={styles.carouselVBar}
          style={{ height: `${percentagesByOption.get(option) ?? 0}%` }}></div>
        <div className={styles.carouselItemOption}>{option.toLocaleString()}</div>
      </button>
    ));
  }, [promptOptions, promptSelection, percentagesByOption, setPromptSelectionIndex]);

  return (
    <div className={styles.container}>
      <div className={styles.promptText}>{prompt.text}</div>
      <div className={styles.carouselContainer} ref={carouselRef}>
        <div
          className={`${styles.carouselItemsContainer} ${
            carouselTransform.dragging ? styles.carouselItemsContainerDragging : ''
          }`}
          style={{ transform: `translateX(${carouselTransform.translateX}px)` }}>
          {carouselOptions}
        </div>
      </div>
      <div className={styles.overallStatsContainer}>
        Room Mood: {averageMood.toLocaleString(undefined, { maximumFractionDigits: 1 })}
      </div>
    </div>
  );
};

/**
 * Pushes an event to the server corresponding to the users current prompt
 * selection once initially and then whenever the selection changes. This
 * will not push events until the journey has started (i.e., journeyTime >= 0),
 * and will stop pushing events once the journey has ended (i.e., journeyTime
 * >= journeyDuration).
 *
 * @param journeyUid The UID of the journey to push events to
 * @param journeyJwt The JWT for adding events to the journey
 * @param sessionUid The session to add events to
 * @param promptSelection The current prompt selection
 * @param journeyDurationSeconds The length of the journey in seconds
 * @param journeyTime The mutable object that keeps track of the current journey time
 * @param loginContext The current login context to use
 */
const usePromptSelectionEvents = (
  journeyUid: string,
  journeyJwt: string,
  sessionUid: string,
  promptSelection: number,
  journeyDurationSeconds: number,
  journeyTime: JourneyTime,
  loginContext: LoginContextValue
): void => {
  const lastPromptSelection = useRef<number | null>(null);
  const lastPromptValueSentAt = useRef<DOMHighResTimeStamp | null>(null);

  // we buffer this a bit to give the join/leave events a moment to be sent
  const minEventTimeExcl = 250;
  const maxEventTimeExcl = journeyDurationSeconds * 1000 - 250;
  const minSpacing = 1000;

  const sendEvent = useCallback(
    async (
      journeyTimeMs: DOMHighResTimeStamp,
      selection: number,
      failures?: number | undefined
    ): Promise<void> => {
      if (failures === undefined) {
        failures = 0;
      }

      if (loginContext.state !== 'logged-in') {
        return;
      }

      try {
        const response = await apiFetch(
          '/api/1/journeys/events/respond_numeric_prompt',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              journey_uid: journeyUid,
              journey_jwt: journeyJwt,
              session_uid: sessionUid,
              journey_time: journeyTimeMs / 1000,
              data: {
                rating: selection,
              },
            }),
          },
          loginContext
        );

        if (!response.ok) {
          if (response.status === 409 && failures < 5) {
            const body = await response.json();
            if (body.type === 'session_not_started') {
              await new Promise((resolve) => setTimeout(resolve, 250));
              return sendEvent(journeyTimeMs, selection, failures + 1);
            }
            throw body;
          }
          throw response;
        }
      } catch (e) {
        if (e instanceof TypeError) {
          console.error('Failed to send prompt selection event - could not connect to server:', e);
        } else if (e instanceof Response) {
          const data = await e.json();
          console.error(
            'Failed to send prompt selection event - server responded with error:',
            data
          );
        } else {
          console.error('Failed to send prompt selection event - unknown error:', e);
        }
      }
    },
    [journeyUid, journeyJwt, sessionUid, loginContext]
  );

  // first event
  useEffect(() => {
    if (lastPromptSelection.current !== null) {
      return;
    }

    let active = true;

    const onTimeChanged = (oldTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (lastPromptSelection.current !== null) {
        unmount();
        return;
      }

      if (newTime >= maxEventTimeExcl) {
        unmount();
        return;
      }

      if (newTime > minEventTimeExcl) {
        const time = Math.max(oldTime, 0);
        sendEvent(time, promptSelection);
        lastPromptSelection.current = promptSelection;
        lastPromptValueSentAt.current = time;
        unmount();
      }
    };

    const predictedIndex = journeyTime.onTimeChanged.current.length;
    journeyTime.onTimeChanged.current.push(onTimeChanged);

    const unmount = () => {
      if (!active) {
        return;
      }

      active = false;
      for (let i = predictedIndex; i >= 0; i--) {
        if (journeyTime.onTimeChanged.current[i] === onTimeChanged) {
          journeyTime.onTimeChanged.current.splice(i, 1);
          break;
        }
      }
    };

    return unmount;
  }, [
    journeyTime.onTimeChanged,
    promptSelection,
    journeyDurationSeconds,
    sendEvent,
    maxEventTimeExcl,
  ]);

  // additional events
  useEffect(() => {
    if (lastPromptSelection.current === null || lastPromptValueSentAt.current === null) {
      return;
    }

    if (promptSelection === lastPromptSelection.current) {
      return;
    }

    const timeMs = journeyTime.time.current;
    if (timeMs <= minEventTimeExcl || timeMs >= maxEventTimeExcl) {
      return;
    }

    const minSendTime = lastPromptValueSentAt.current + minSpacing;
    if (timeMs < minSendTime) {
      // do it later
      let active = true;

      const onTimeChanged = (oldTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
        if (!active) {
          return;
        }

        if (newTime <= minEventTimeExcl || newTime >= maxEventTimeExcl) {
          unmount();
          return;
        }

        if (newTime >= minSendTime) {
          sendEvent(newTime, promptSelection);
          lastPromptSelection.current = promptSelection;
          lastPromptValueSentAt.current = newTime;
          unmount();
        }
      };

      const predictedIndex = journeyTime.onTimeChanged.current.length;
      journeyTime.onTimeChanged.current.push(onTimeChanged);

      const unmount = () => {
        if (!active) {
          return;
        }

        active = false;
        for (let i = predictedIndex; i >= 0; i--) {
          if (journeyTime.onTimeChanged.current[i] === onTimeChanged) {
            journeyTime.onTimeChanged.current.splice(i, 1);
            break;
          }
        }
      };
      return unmount;
    }

    sendEvent(timeMs, promptSelection);
    lastPromptSelection.current = promptSelection;
    lastPromptValueSentAt.current = timeMs;
  }, [
    journeyTime.time,
    journeyTime.onTimeChanged,
    promptSelection,
    journeyDurationSeconds,
    sendEvent,
    maxEventTimeExcl,
  ]);
};

type CarouselTransformKwargs = {
  /**
   * The width of an inactive item, in pixels
   */
  inactiveItemWidth: number;
  /**
   * The width of the active item, in pixels
   */
  activeItemWidth: number;
  /**
   * The gap between two inactive items, in pixels
   */
  inactiveInactiveGap: number;
  /**
   * The gap between an inactive item and the active item, in pixels
   */
  inactiveActiveGap: number;
  /**
   * The total number of items in the carousel
   */
  numItems: number;
  /**
   * The index of the currently active item. If this changes but not due
   * to user interaction, the carousel will glue to the new active item.
   */
  activeItemIndex: number;
  /**
   * A ref to the carousel container element, as its width is required
   * for centering the active item. We will not modify the style of this element.
   */
  carouselRef: RefObject<HTMLElement | null>;
  /**
   * The width to assume the carousel container will be, in pixels,
   * if the ref is null. This is used to determine the default translation
   */
  defaultCarouselWidth: number;
  /**
   * Used to set the active item due to user interaction, by index
   * @param idx the index of the item to set as active
   */
  setActiveItemIndex: (idx: number) => void;
};

/**
 * Determines the appropriate translation for a horizontal carousels items
 * based on the active item index and the users current interaction.
 */
const useCarouselTransform = ({
  inactiveItemWidth,
  activeItemWidth,
  inactiveInactiveGap,
  inactiveActiveGap,
  numItems,
  activeItemIndex,
  carouselRef,
  defaultCarouselWidth,
  setActiveItemIndex,
}: CarouselTransformKwargs): { translateX: number; dragging: boolean } => {
  const calculateDefaultItemLefts = useCallback(
    function* () {
      let offset = 0;
      let prevActive = false;
      for (let i = 0; i < numItems; i++) {
        let active = i === activeItemIndex;

        if (i > 0) {
          if (prevActive || active) {
            offset += inactiveActiveGap;
          } else {
            offset += inactiveInactiveGap;
          }
        }

        yield offset;
        offset += active ? activeItemWidth : inactiveItemWidth;
        prevActive = active;
      }
    },
    [
      activeItemIndex,
      inactiveActiveGap,
      inactiveInactiveGap,
      activeItemWidth,
      inactiveItemWidth,
      numItems,
    ]
  );

  const cachedItemLefts = useMemo(() => {
    const arr = [];
    const iter = calculateDefaultItemLefts();
    let next = iter.next();
    while (!next.done) {
      arr.push(next.value);
      next = iter.next();
    }
    return arr;
  }, [calculateDefaultItemLefts]);

  const getDefaultItemLeft = useCallback(
    (idx: number) => {
      return cachedItemLefts[idx];
    },
    [cachedItemLefts]
  );

  const [carouselItemsWidth, setCarouselItemsWidth] = useState(
    carouselRef.current === null || carouselRef.current.offsetWidth === 0
      ? defaultCarouselWidth
      : carouselRef.current.offsetWidth
  );

  if (
    carouselRef.current !== null &&
    carouselRef.current.offsetWidth !== carouselItemsWidth &&
    carouselRef.current.offsetWidth !== 0
  ) {
    setCarouselItemsWidth(carouselRef.current.offsetWidth);
  }

  // carousel items width on resize
  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    const postDebounce = () => {
      timeout = null;
      if (carouselRef.current !== null) {
        setCarouselItemsWidth(carouselRef.current.offsetWidth);
      }
    };

    const onResize = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(postDebounce, 250);
    };

    window.addEventListener('resize', onResize);
    return () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      window.removeEventListener('resize', onResize);
    };
  }, [carouselRef]);

  const getTranslationToCenterIndex = useCallback(
    (idx: number) => {
      const itemLeft = getDefaultItemLeft(idx);
      const itemWidth = idx === activeItemIndex ? activeItemWidth : inactiveItemWidth;
      const desiredLeft = (carouselItemsWidth - itemWidth) / 2;
      return desiredLeft - itemLeft;
    },
    [carouselItemsWidth, getDefaultItemLeft, activeItemIndex, activeItemWidth, inactiveItemWidth]
  );

  const initialActiveItemIndexRef = useRef(activeItemIndex);
  const [initialTranslateX, minTranslateX, maxTranslateX] = useMemo(() => {
    return [
      getTranslationToCenterIndex(initialActiveItemIndexRef.current),
      getTranslationToCenterIndex(numItems - 1),
      getTranslationToCenterIndex(0),
    ];
  }, [getTranslationToCenterIndex, numItems]);

  const [translateX, setTranslateX] = useState(initialTranslateX);
  const [dragging, setDragging] = useState(false);
  const mouseDragging = useMouseDragging({
    minTranslateX,
    maxTranslateX,
    setTranslateX,
    carouselRef,
  });
  const touchDragging = useTouchDragging({
    minTranslateX,
    maxTranslateX,
    setTranslateX,
  });

  useEffect(() => {
    setDragging(mouseDragging || touchDragging);
  }, [mouseDragging, touchDragging]);

  // glue translation when not dragging
  useEffect(() => {
    if (dragging) {
      return;
    }

    const newTranslateX = getTranslationToCenterIndex(activeItemIndex);
    setTranslateX(newTranslateX);
  }, [dragging, activeItemIndex, getTranslationToCenterIndex]);

  // scroll wheel when not dragging
  useEffect(() => {
    if (dragging) {
      return;
    }

    const onScrollWheel = (e: WheelEvent) => {
      const deltaX = e.deltaX === 0 ? e.deltaY : e.deltaX;

      if (deltaX > 0) {
        if (activeItemIndex < numItems - 1) {
          setActiveItemIndex(activeItemIndex + 1);
        }
      } else if (deltaX < 0) {
        if (activeItemIndex > 0) {
          setActiveItemIndex(activeItemIndex - 1);
        }
      }
    };

    window.addEventListener('wheel', onScrollWheel);
    return () => {
      window.removeEventListener('wheel', onScrollWheel);
    };
  }, [dragging, numItems, activeItemIndex, setActiveItemIndex]);

  // left/right arrow keys when not dragging
  useEffect(() => {
    if (dragging) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        if (activeItemIndex > 0) {
          setActiveItemIndex(activeItemIndex - 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (activeItemIndex < numItems - 1) {
          setActiveItemIndex(activeItemIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dragging, numItems, activeItemIndex, setActiveItemIndex]);

  // update active when dragging
  useEffect(() => {
    if (!dragging) {
      return;
    }

    let nearestCenterIdx = activeItemIndex;
    let bestDistance = Number.MAX_SAFE_INTEGER;

    const trueCenter = carouselItemsWidth / 2;

    for (let i = 0; i < numItems; i++) {
      const leftBeforeTranslation = getDefaultItemLeft(i);
      const width = i === activeItemIndex ? activeItemWidth : inactiveItemWidth;
      const centerBeforeTranslation = leftBeforeTranslation + width / 2;

      const centerAfterTranslation = centerBeforeTranslation + translateX;
      let distToCenter = Math.abs(centerAfterTranslation - trueCenter);
      // be a little sticky to avoid jumping between items from transitions
      if (i === activeItemIndex) {
        distToCenter -= Math.max(activeItemWidth, inactiveItemWidth) / 2;
      }

      if (distToCenter < bestDistance) {
        bestDistance = distToCenter;
        nearestCenterIdx = i;
      }
    }

    if (nearestCenterIdx !== activeItemIndex) {
      setActiveItemIndex(nearestCenterIdx);
    }
  }, [
    dragging,
    translateX,
    activeItemWidth,
    carouselItemsWidth,
    getDefaultItemLeft,
    inactiveItemWidth,
    numItems,
    activeItemIndex,
    setActiveItemIndex,
  ]);

  return { translateX, dragging };
};

type DraggingKwargs = {
  minTranslateX: number;
  maxTranslateX: number;
  setTranslateX: Dispatch<SetStateAction<number>>;
};

const useMouseDragging = ({
  minTranslateX,
  maxTranslateX,
  setTranslateX,
  carouselRef,
}: DraggingKwargs & { carouselRef: RefObject<HTMLElement | null> }): boolean => {
  const [dragging, setDragging] = useState<boolean>(false);

  // can't use these as dependencies, since they can change when the
  // active item changes, and cancelling the effect loses our information
  // about accumulated delta / last touch x, which leads to a jump
  const minTranslateXRef = useRef(minTranslateX);
  const maxTranslateXRef = useRef(maxTranslateX);

  minTranslateXRef.current = minTranslateX;
  maxTranslateXRef.current = maxTranslateX;

  useEffect(() => {
    if (carouselRef.current === null) {
      return;
    }

    let touchDragging = false; // when touch events are fired, ignore mouse events
    let accumulatedDelta = 0;
    let pushingDeltas = false;
    const autoStopPushingDeltaTimeout = 1000;
    let stopPushingDeltas: (() => void) | null = null;
    let lastMouseX: number | null = null;

    const startPushingDeltas = () => {
      if (stopPushingDeltas !== null) {
        stopPushingDeltas();
      }

      let active = true;
      stopPushingDeltas = () => {
        active = false;
        pushingDeltas = false;
        stopPushingDeltas = null;
        setDragging(false);
      };

      pushingDeltas = true;
      setDragging(true);
      let lastTime: DOMHighResTimeStamp | null = null;
      let lastTimeOfDelta: DOMHighResTimeStamp = 0;

      const onAnimationFrame = (newTime: DOMHighResTimeStamp) => {
        if (!active) {
          return;
        }

        if (lastTime === null) {
          lastTime = newTime;
          lastTimeOfDelta = newTime;
          requestAnimationFrame(onAnimationFrame);
          return;
        }

        if (accumulatedDelta !== 0) {
          ((delta) => {
            setTranslateX((prevTranslateX) => {
              return Math.min(
                Math.max(Math.round(prevTranslateX + delta), minTranslateXRef.current),
                maxTranslateXRef.current
              );
            });
          })(accumulatedDelta);
          accumulatedDelta = 0;
        } else {
          const timeSinceDelta = newTime - lastTimeOfDelta;
          if (timeSinceDelta > autoStopPushingDeltaTimeout) {
            stopPushingDeltas!();
            return;
          }
        }

        lastTime = newTime;
        requestAnimationFrame(onAnimationFrame);
      };
      requestAnimationFrame(onAnimationFrame);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        return;
      }

      touchDragging = true;
      if (stopPushingDeltas !== null) {
        stopPushingDeltas();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length !== 0) {
        return;
      }

      touchDragging = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (touchDragging) {
        lastMouseX = null;
        return;
      }

      if (e.buttons !== 1) {
        if (stopPushingDeltas !== null) {
          stopPushingDeltas();
        }
        lastMouseX = null;
        return;
      }

      if (lastMouseX === null) {
        lastMouseX = e.clientX;
        return;
      }

      if (!pushingDeltas) {
        startPushingDeltas();
      }

      accumulatedDelta += e.clientX - lastMouseX;
      lastMouseX = e.clientX;
    };

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchend', onTouchEnd);

    const mouseMoveEle = carouselRef.current;
    mouseMoveEle.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      mouseMoveEle.removeEventListener('mousemove', onMouseMove);
    };
  }, [carouselRef, setTranslateX]);

  return dragging;
};

const useTouchDragging = ({
  minTranslateX,
  maxTranslateX,
  setTranslateX,
}: DraggingKwargs): boolean => {
  const [dragging, setDragging] = useState<boolean>(false);

  // can't use these as dependencies, since they can change when the
  // active item changes, and cancelling the effect loses our information
  // about accumulated delta / last touch x, which leads to a jump
  const minTranslateXRef = useRef(minTranslateX);
  const maxTranslateXRef = useRef(maxTranslateX);

  minTranslateXRef.current = minTranslateX;
  maxTranslateXRef.current = maxTranslateX;

  useEffect(() => {
    let lastTouchX: number | null = null;
    let accumulatedDelta = 0;
    let stopPushingDeltas: (() => void) | null = null;

    const startPushingDeltas = () => {
      if (stopPushingDeltas !== null) {
        stopPushingDeltas();
      }

      let active = true;
      stopPushingDeltas = () => {
        active = false;
      };

      const onAnimationFrame = () => {
        if (!active) {
          return;
        }

        if (accumulatedDelta !== 0) {
          ((delta) => {
            setTranslateX((prevTranslateX) => {
              return Math.min(
                Math.max(Math.round(prevTranslateX + delta * 1.5), minTranslateXRef.current),
                maxTranslateXRef.current
              );
            });
          })(accumulatedDelta);
          accumulatedDelta = 0;
        }
        requestAnimationFrame(onAnimationFrame);
      };

      requestAnimationFrame(onAnimationFrame);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        return;
      }

      lastTouchX = e.touches[0].clientX;
      accumulatedDelta = 0;
      setDragging(true);
      startPushingDeltas();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length !== 0) {
        return;
      }

      lastTouchX = null;
      if (stopPushingDeltas !== null) {
        stopPushingDeltas();
      }
      setDragging(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        return;
      }

      if (lastTouchX === null) {
        return;
      }

      accumulatedDelta += e.touches[0].clientX - lastTouchX;
      lastTouchX = e.touches[0].clientX;
    };

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [setTranslateX]);

  return dragging;
};
