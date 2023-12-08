import { ReactElement, useEffect, useMemo, useRef } from 'react';
import { InteractiveNumericPrompt } from '../models/InteractivePrompt';
import { CountdownText } from './CountdownText';
import styles from './NumericPrompt.module.css';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { apiFetch } from '../../../shared/ApiConstants';
import { PromptTitle } from './PromptTitle';
import { CarouselInfo, useCarouselInfo } from '../../../shared/hooks/useCarouselInfo';
import { Carousel } from '../../../shared/components/Carousel';
import { ProfilePictures } from './ProfilePictures';
import { Button } from '../../../shared/forms/Button';
import {
  VPFRRProps,
  VerticalPartlyFilledRoundedRect,
} from '../../../shared/anim/VerticalPartlyFilledRoundedRect';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { PromptProps } from '../models/PromptProps';
import { PromptSettings } from '../models/PromptSettings';
import { usePromptResources } from '../hooks/usePromptResources';

const optionWidthPx = 75;
const optionHeightPx = 75;
const optionGapPx = 20;
const inactiveOpacity = 0.4;
const activeOpacity = 1.0;

const optionUnfilledColor: [number, number, number, number] = [1, 1, 1, 0.5];
const optionFilledColor: [number, number, number, number] = [1, 1, 1, 1];

const settings: PromptSettings<InteractiveNumericPrompt, number | null> = {
  getSelectionFromIndex: (prompt, index) => {
    if (index === null) {
      return null;
    }

    let idx = -1;
    for (let val = prompt.prompt.min; val <= prompt.prompt.max; val += prompt.prompt.step) {
      idx++;
      if (idx === index) {
        return val;
      }
    }

    return null;
  },
  getResponseDistributionFromStats: (prompt, stats) => {
    const numericActive = stats.numericActive ?? new Map<number, number>();

    const result: number[] = [];
    for (let i = prompt.prompt.min; i <= prompt.prompt.max; i += prompt.prompt.step) {
      result.push(numericActive.get(i) ?? 0);
    }
    return result;
  },
  storeResponse: async (loginContextRaw, prompt, time, response, index) => {
    if (index === null) {
      return;
    }

    const loginContextUnch = loginContextRaw.value.get();
    if (loginContextUnch.state !== 'logged-in') {
      return;
    }

    await apiFetch(
      '/api/1/interactive_prompts/events/respond_numeric_prompt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          interactive_prompt_uid: prompt.uid,
          interactive_prompt_jwt: prompt.jwt,
          session_uid: prompt.sessionUid,
          prompt_time: time / 1000,
          data: {
            rating: response,
          },
        }),
        keepalive: true,
      },
      loginContextUnch
    );
  },
};

export const NumericPrompt = (
  props: PromptProps<InteractiveNumericPrompt, number | null>
): ReactElement => {
  const resources = usePromptResources(props, settings);
  const hasSelectionVWC = useMappedValueWithCallbacks(resources.selectedIndex, (s) => s !== null);
  const screenSize = useWindowSize();

  const promptOptions = useMemo<number[]>(() => {
    const prompt = resources.prompt.prompt;
    const res: number[] = [];
    for (let i = prompt.min; i <= prompt.max; i += prompt.step) {
      res.push(i);
    }
    return res;
  }, [resources]);

  const panningVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const [carouselInfo, selectItemInCarousel, panCarouselTo] = useCarouselInfo({
    settings: {
      type: 'react-rerender',
      props: {
        visibleWidth: Math.min(screenSize.width, 440),
        itemWidth: optionWidthPx,
        itemGap: optionGapPx,
        numItems: promptOptions.length,
        height: optionHeightPx,
      },
    },
    panning: {
      type: 'callbacks',
      props: panningVWC.get,
      callbacks: panningVWC.callbacks,
    },
  });
  useCarouselSelectionForSelection(carouselInfo, resources.selectedIndex);

  const infos: WritableValueWithCallbacks<VPFRRProps>[] = useMemo(() => {
    return promptOptions.map((_, index) =>
      createWritableValueWithCallbacks<VPFRRProps>({
        filledHeight: 0,
        borderRadius: Math.min(optionWidthPx / 2, optionHeightPx / 2),
        unfilledColor: optionUnfilledColor,
        filledColor: optionFilledColor,
        opacity: resources.selectedIndex.get() === index ? activeOpacity : inactiveOpacity,
        border: { width: 2 },
      })
    );
  }, [resources, promptOptions]);

  // manages the opacity on the options
  useEffect(() => {
    let highlighted: number | null = null;
    resources.selectedIndex.callbacks.add(handleInfoEvent);
    handleInfoEvent();
    return () => {
      resources.selectedIndex.callbacks.remove(handleInfoEvent);
      removeHighlight();
    };

    function removeHighlight() {
      if (highlighted === null) {
        return;
      }
      infos[highlighted].set(
        Object.assign({}, infos[highlighted].get(), { opacity: inactiveOpacity })
      );
      infos[highlighted].callbacks.call(undefined);
      highlighted = null;
    }

    function handleInfoEvent() {
      const sel = resources.selectedIndex.get();
      if (sel === highlighted) {
        return;
      }

      removeHighlight();
      if (sel === null) {
        return;
      }

      infos[sel].set(Object.assign({}, infos[sel].get(), { opacity: activeOpacity }));
      infos[sel].callbacks.call(undefined);
      highlighted = sel;
    }
  }, [resources, infos]);

  const statsAmountRef = useRef<HTMLDivElement>(null);
  // manages the height on the options and the value of statsAmountRef
  useEffect(() => {
    resources.clientPredictedResponseDistribution.callbacks.add(update);
    update();
    return () => {
      resources.clientPredictedResponseDistribution.callbacks.remove(update);
    };

    function update() {
      const newCorrectedStats = resources.clientPredictedResponseDistribution.get();

      const total = newCorrectedStats.reduce((a, b) => a + b, 0);
      const fractionals =
        total === 0 ? newCorrectedStats.map(() => 0) : newCorrectedStats.map((n) => n / total);
      const average = promptOptions.reduce((a, b, i) => a + b * fractionals[i], 0);
      if (statsAmountRef.current !== null) {
        statsAmountRef.current.textContent = average.toFixed(2);
      }

      fractionals.forEach((fractional, index) => {
        const old = infos[index].get();

        if (old.filledHeight !== fractional) {
          infos[index].set(Object.assign({}, old, { filledHeight: fractional }));
          infos[index].callbacks.call(undefined);
        }
      });
    }
  }, [resources, infos, promptOptions]);

  const finishEarly = props.finishEarly;

  return (
    <div className={styles.container}>
      {props.countdown && (
        <CountdownText promptTime={resources.time} prompt={resources.prompt} {...props.countdown} />
      )}
      <div className={styles.prompt}>
        <PromptTitle
          text={resources.prompt.prompt.text}
          subtitle={props.subtitle}
          titleMaxWidth={props.titleMaxWidth}
        />
        <div className={styles.carouselContainer}>
          <Carousel info={carouselInfo} panning={panningVWC} panCarouselTo={panCarouselTo}>
            {promptOptions.map((option, optionIndex) => (
              <button
                key={option}
                type="button"
                className={styles.item}
                onClick={(e) => {
                  e.preventDefault();
                  const oldInfo = carouselInfo.get();
                  if (
                    oldInfo.selectedIndex === optionIndex ||
                    oldInfo.panning ||
                    oldInfo.inClickCooldown
                  ) {
                    return;
                  }

                  selectItemInCarousel(optionIndex);
                }}>
                <div className={styles.itemBackground}>
                  <VerticalPartlyFilledRoundedRect
                    props={{
                      type: 'callbacks',
                      props: () => infos[optionIndex].get(),
                      callbacks: infos[optionIndex].callbacks,
                    }}
                    width={optionWidthPx}
                    height={optionHeightPx}
                  />
                </div>
                <div className={styles.itemForeground}>{option}</div>
              </button>
            ))}
          </Carousel>
        </div>
        <div className={styles.statsContainer}>
          Average: <div className={styles.statsAmount} ref={statsAmountRef} />
        </div>
        {finishEarly && (
          <div
            className={styles.continueContainer}
            style={
              props.countdown && screenSize.height <= 750
                ? {}
                : { paddingTop: '45px', paddingBottom: '60px' }
            }>
            <RenderGuardedComponent
              props={hasSelectionVWC}
              component={(hasSelection) => (
                <Button
                  type="button"
                  fullWidth
                  variant={hasSelection ? 'filled' : 'link-white'}
                  onClick={resources.onSkip}>
                  {hasSelection ? (finishEarly === true ? 'Continue' : finishEarly.cta) : 'Skip'}
                </Button>
              )}
            />
          </div>
        )}
        <div
          className={styles.profilePictures}
          style={{ width: `${carouselInfo.get().computed.visibleWidth}px` }}>
          <ProfilePictures profilePictures={resources.profilePictures} />
        </div>
      </div>
    </div>
  );
};

/**
 * Uses the carousel info as the current selected value for the numeric prompt
 */
const useCarouselSelectionForSelection = (
  carouselInfo: ValueWithCallbacks<CarouselInfo>,
  selection: WritableValueWithCallbacks<number | null>
) => {
  useEffect(() => {
    carouselInfo.callbacks.add(recheckSelection);
    recheckSelection();
    return () => {
      carouselInfo.callbacks.remove(recheckSelection);
    };

    function recheckSelection() {
      const correctSelectionIndex = carouselInfo.get().selectedIndex;

      if (selection.get() !== correctSelectionIndex) {
        selection.set(correctSelectionIndex);
        selection.callbacks.call(undefined);
      }
    }
  }, [carouselInfo, selection]);
};
