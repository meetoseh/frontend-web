import { useContext, useEffect, useMemo } from 'react';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { InteractivePrompt } from '../models/InteractivePrompt';
import { PromptProps } from '../models/PromptProps';
import { PromptResources } from '../models/PromptResources';
import { PromptSettings } from '../models/PromptSettings';
import { useIndexableFakeMove } from './useIndexableFakeMove';
import { useJoinLeave } from './useJoinLeave';
import { useOnFinished } from './useOnFinished';
import { useProfilePictures } from './useProfilePictures';
import { usePromptTime } from './usePromptTime';
import { useSimpleSelectionHandler } from './useSimpleSelectionHandler';
import { useStats } from './useStats';

/**
 * Loads the prompt resources for the prompt with the given settings.
 *
 * @param props The prompt props
 * @param settings The prompt settings
 * @returns The prompt resources
 */
export const usePromptResources = <P extends InteractivePrompt, R>(
  props: PromptProps<P, R>,
  settings: PromptSettings<P, R>
): PromptResources<P, R> => {
  const time = usePromptTime({
    type: 'react-rerender',
    props: { initialTime: -250, paused: props.paused ?? false },
  });
  const stats = useStats({
    prompt: {
      type: 'react-rerender',
      props: props.prompt,
    },
    promptTime: {
      type: 'callbacks',
      props: time.get,
      callbacks: time.callbacks,
    },
  });
  const profilePictures = useProfilePictures({
    prompt: {
      type: 'react-rerender',
      props: props.prompt,
    },
    promptTime: {
      type: 'callbacks',
      props: time.get,
      callbacks: time.callbacks,
    },
    stats: {
      type: 'callbacks',
      props: stats.get,
      callbacks: stats.callbacks,
    },
  });
  const trueResponseDistribution = useMappedValueWithCallbacks(stats, (s) =>
    settings.getResponseDistributionFromStats(props.prompt, s)
  );
  const selectedIndex = useWritableValueWithCallbacks<number | null>(() => {
    props.onResponse?.(settings.getSelectionFromIndex(props.prompt, null));
    return null;
  });
  const selectedValue = useMappedValueWithCallbacks(selectedIndex, (i) =>
    settings.getSelectionFromIndex(props.prompt, i)
  );
  useEffect(() => {
    selectedValue.callbacks.add(onSelectionChanged);
    onSelectionChanged();
    return () => {
      selectedValue.callbacks.remove(onSelectionChanged);
    };

    function onSelectionChanged() {
      props.onResponse?.call(undefined, selectedValue.get());
    }
  }, [selectedValue, props.onResponse]);
  const clientPredictedResponseDistribution = useIndexableFakeMove({
    promptTime: {
      type: 'callbacks',
      props: time.get,
      callbacks: time.callbacks,
    },
    responses: {
      type: 'callbacks',
      props: trueResponseDistribution.get,
      callbacks: trueResponseDistribution.callbacks,
    },
    selection: {
      type: 'callbacks',
      props: selectedIndex.get,
      callbacks: selectedIndex.callbacks,
    },
  });
  const joinLeave = useJoinLeave({
    prompt: {
      type: 'react-rerender',
      props: props.prompt,
    },
    promptTime: {
      type: 'callbacks',
      props: time.get,
      callbacks: time.callbacks,
    },
  });
  const { onSkip } = useOnFinished({
    joinLeave: { type: 'callbacks', props: joinLeave.get, callbacks: joinLeave.callbacks },
    promptTime: { type: 'callbacks', props: time.get, callbacks: time.callbacks },
    selection: {
      type: 'callbacks',
      props: selectedValue.get,
      callbacks: selectedValue.callbacks,
    },
    onFinished: props.onFinished,
  });
  const loginContext = useContext(LoginContext);
  useSimpleSelectionHandler({
    selection: { type: 'callbacks', props: selectedIndex.get, callbacks: selectedIndex.callbacks },
    prompt: { type: 'react-rerender', props: props.prompt },
    joinLeave: { type: 'callbacks', props: joinLeave.get, callbacks: joinLeave.callbacks },
    promptTime: { type: 'callbacks', props: time.get, callbacks: time.callbacks },
    callback: (selected: number | null, time: number) =>
      settings.storeResponse(
        loginContext,
        props.prompt,
        time,
        settings.getSelectionFromIndex(props.prompt, selected),
        selected
      ),
  });

  props.leavingCallback.current = () => {
    joinLeave.get().leave();
  };

  return useMemo(
    () => ({
      prompt: props.prompt,
      time,
      stats,
      profilePictures,
      selectedIndex,
      selectedValue,
      clientPredictedResponseDistribution,
      onSkip,
    }),
    [
      props.prompt,
      time,
      stats,
      profilePictures,
      selectedIndex,
      selectedValue,
      clientPredictedResponseDistribution,
      onSkip,
    ]
  );
};
