import { ReactElement, useEffect, useMemo, useRef } from 'react';
import { InteractiveWordPrompt } from '../models/InteractivePrompt';
import { CountdownText } from './CountdownText';
import styles from './WordPrompt.module.css';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  createWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { apiFetch } from '../../../shared/ApiConstants';
import { ProfilePictures } from './ProfilePictures';
import { PromptTitle } from './PromptTitle';
import { Button } from '../../../shared/forms/Button';
import { HorizontalPartlyFilledRoundedRect } from '../../../shared/anim/HorizontalPartlyFilledRoundedRect';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { PromptProps } from '../models/PromptProps';
import { PromptSettings } from '../models/PromptSettings';
import { usePromptResources } from '../hooks/usePromptResources';

type WordPromptProps = PromptProps<InteractiveWordPrompt, string | null>;

const unfilledColor: [number, number, number, number] = [68 / 255, 98 / 255, 102 / 255, 0.4];
const filledColor: [number, number, number, number] = [68 / 255, 98 / 255, 102 / 255, 0.9];

const settings: PromptSettings<InteractiveWordPrompt, string | null> = {
  getSelectionFromIndex: (prompt, index) =>
    index ? (prompt.prompt.options ?? [])[index] ?? null : null,
  getResponseDistributionFromStats: (prompt, stats) =>
    stats.wordActive ?? prompt.prompt.options.map(() => 0),
  storeResponse: async (loginContext, prompt, time, response, index) => {
    if (index === null) {
      return;
    }

    await apiFetch(
      '/api/1/interactive_prompts/events/respond_word_prompt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          interactive_prompt_uid: prompt.uid,
          interactive_prompt_jwt: prompt.jwt,
          session_uid: prompt.sessionUid,
          prompt_time: time / 1000,
          data: {
            index,
          },
        }),
        keepalive: true,
      },
      loginContext
    );
  },
};

export const WordPrompt = (props: WordPromptProps): ReactElement => {
  const resources = usePromptResources(props, settings);
  const hasSelectionVWC = useMappedValueWithCallbacks(resources.selectedIndex, (s) => s !== null);
  const screenSize = useWindowSize();

  const boundFilledWidthGetterSetters: WritableValueWithCallbacks<number>[] = useMemo(() => {
    return resources.prompt.prompt.options.map(() => createWritableValueWithCallbacks<number>(0));
  }, [resources]);

  useEffect(() => {
    resources.clientPredictedResponseDistribution.callbacks.add(updateWidths);
    updateWidths();
    return () => {
      resources.clientPredictedResponseDistribution.callbacks.add(updateWidths);
    };

    function updateWidths() {
      const correctedStats = resources.clientPredictedResponseDistribution.get();
      const totalResponses = correctedStats.reduce((a, b) => a + b, 0);
      const fractionals =
        totalResponses === 0
          ? correctedStats.map(() => 0)
          : correctedStats.map((v) => v / totalResponses);
      fractionals.forEach((fractional, idx) => {
        const old = boundFilledWidthGetterSetters[idx].get();
        if (old === fractional) {
          return;
        }
        boundFilledWidthGetterSetters[idx].set(fractional);
        boundFilledWidthGetterSetters[idx].callbacks.call(undefined);
      });
    }
  }, [resources, boundFilledWidthGetterSetters]);

  const optionWidth = Math.min(390, Math.min(screenSize.width, 440) - 48);
  const finishEarly = props.finishEarly;

  return (
    <div className={styles.container}>
      {props.countdown && (
        <CountdownText promptTime={resources.time} prompt={resources.prompt} {...props.countdown} />
      )}
      <div
        className={styles.prompt}
        style={
          !props.countdown || !finishEarly || screenSize.height > 700 ? {} : { marginTop: '12px' }
        }>
        {/* we run out of space with countdown && finishEarly */}
        <PromptTitle
          text={resources.prompt.prompt.text}
          subtitle={props.subtitle}
          titleMaxWidth={props.titleMaxWidth}
        />
        <div className={styles.options}>
          {resources.prompt.prompt.options.map((option, idx) => {
            return (
              <div key={idx} className={styles.option} style={{ width: optionWidth, height: 54 }}>
                <div className={styles.optionBackground}>
                  <HorizontalPartlyFilledRoundedRect
                    props={{
                      type: 'callbacks',
                      props: () => ({
                        filledWidth: boundFilledWidthGetterSetters[idx].get(),
                        unfilledColor: unfilledColor,
                        filledColor: filledColor,
                        opacity: 1.0,
                        borderRadius: 10,
                      }),
                      callbacks: boundFilledWidthGetterSetters[idx].callbacks,
                    }}
                    height={54}
                    width={optionWidth}
                  />
                </div>
                <button
                  className={styles.optionForeground}
                  style={{ width: optionWidth, height: 54 }}
                  onClick={() => {
                    if (resources.selectedIndex.get() === idx) {
                      return;
                    }

                    resources.selectedIndex.set(idx);
                    resources.selectedIndex.callbacks.call(undefined);
                  }}>
                  <CheckmarkFromSelection index={idx} selection={resources.selectedIndex} />
                  <div className={styles.optionText}>{option}</div>
                </button>
              </div>
            );
          })}
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
          style={Object.assign(
            { width: `${optionWidth}px` },
            props.countdown || !finishEarly
              ? null
              : {
                  marginTop: '5px',
                  marginBottom: '8px',
                }
          )}>
          <ProfilePictures profilePictures={resources.profilePictures} />
        </div>
      </div>
    </div>
  );
};

/**
 * Shows a checkmark which is checked if the selection matches the
 * given index, and unchecked otherwise, without triggering react
 * state updates.
 */
const CheckmarkFromSelection = ({
  index,
  selection,
}: {
  index: number;
  selection: ValueWithCallbacks<number | null>;
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isChecked: boolean | null = null;
    selection.callbacks.add(onEvent);
    return () => {
      selection.callbacks.remove(onEvent);
    };

    function onEvent() {
      const isNowChecked = selection.get() === index;
      if (isChecked !== isNowChecked && containerRef.current) {
        containerRef.current.classList.toggle(styles.checkmarkContainerChecked, isNowChecked);
      }
    }
  }, [index, selection]);

  return (
    <div
      ref={containerRef}
      className={`${styles.checkmarkContainer} ${
        index === selection.get() ? styles.checkmarkContainerChecked : ''
      }`}>
      <div className={styles.checkmark} />
    </div>
  );
};
