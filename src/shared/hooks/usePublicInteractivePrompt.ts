import { ReactElement, useCallback, useContext } from 'react';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import {
  InteractivePrompt,
  interactivePromptKeyMap,
} from '../../user/interactive_prompt/models/InteractivePrompt';
import { apiFetch } from '../ApiConstants';
import { LoginContext } from '../contexts/LoginContext';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useMappedValuesWithCallbacks } from './useMappedValuesWithCallbacks';
import { useValueWithCallbacksEffect } from './useValueWithCallbacksEffect';
import { setVWC } from '../lib/setVWC';
import { DisplayableError } from '../lib/errors';

export type PublicInteractivePrompt =
  | {
      /**
       * If the prompt is loaded, the prompt, otherwise null.
       */
      prompt: InteractivePrompt;

      /**
       * True if we are still trying to load the prompt, false otherwise.
       */
      loading: false;

      /**
       * If an error occurred that prevents the prompt from being loaded, an
       * element describing the error, otherwise null
       */
      error: null;
    }
  | {
      /**
       * If the prompt is loaded, the prompt, otherwise null.
       */
      prompt: null;

      /**
       * True if we are still trying to load the prompt, false otherwise.
       */
      loading: boolean;

      /**
       * If an error occurred that prevents the prompt from being loaded, an
       * element describing the error, otherwise null
       */
      error: DisplayableError | null;
    };

type PublicInteractivePromptProps = {
  /**
   * The identifier for the public interactive prompt to load
   */
  identifier: string;

  /**
   * If set to false, the prompt will be unloaded (if already loaded),
   * and won't be loaded (if not already loaded). Otherwise, ignored.
   */
  load?: boolean;
};

/**
 * Loads the public interactive prompt with the given identifier from the
 * server, starting a session.
 */
export const usePublicInteractivePrompt = (
  propsVariableStrategy: VariableStrategyProps<PublicInteractivePromptProps>
): ValueWithCallbacks<PublicInteractivePrompt> => {
  const propsVWC = useVariableStrategyPropsAsValueWithCallbacks(propsVariableStrategy);
  const loginContextRaw = useContext(LoginContext);
  const promptVWC = useWritableValueWithCallbacks<{
    identifier: string;
    prompt: InteractivePrompt;
  } | null>(() => null);
  const errorVWC = useWritableValueWithCallbacks<DisplayableError | null>(() => null);

  useValueWithCallbacksEffect(
    loginContextRaw.value,
    useCallback(
      (loginContextUnch) => {
        if (loginContextUnch.state !== 'logged-in') {
          setVWC(promptVWC, null);
          return;
        }
        const loginContext = loginContextUnch;

        let queued = false;
        let running = false;
        let active = true;

        propsVWC.callbacks.add(handlePropsChanged);
        handlePropsChanged();
        return () => {
          active = false;
          propsVWC.callbacks.remove(handlePropsChanged);
        };

        async function handleProps(props: PublicInteractivePromptProps) {
          if (props.load === false) {
            setVWC(promptVWC, null);
            return;
          }

          const old = promptVWC.get();
          if (old !== null && old.identifier === props.identifier) {
            return;
          }

          setVWC(promptVWC, null);
          const response = await apiFetch(
            '/api/1/interactive_prompts/start_public',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({
                identifier: props.identifier,
              }),
            },
            loginContext
          );

          if (!response.ok) {
            throw response;
          }

          const data = await response.json();
          const parsed = convertUsingKeymap(data, interactivePromptKeyMap);
          setVWC(promptVWC, { identifier: props.identifier, prompt: parsed });
        }

        async function handlePropsChanged() {
          if (!active) {
            return;
          }

          if (running) {
            queued = true;
            return;
          }

          running = true;
          queued = true;
          while (queued) {
            queued = false;
            setVWC(errorVWC, null);
            try {
              await handleProps(propsVWC.get());
            } catch (e) {
              const described =
                e instanceof DisplayableError
                  ? e
                  : new DisplayableError('client', 'load prompt', `${e}`);
              if (!queued) {
                setVWC(errorVWC, described);
              }
            }
          }
          running = false;
        }
      },
      [propsVWC, errorVWC, promptVWC]
    )
  );

  return useMappedValuesWithCallbacks([promptVWC, errorVWC], (): PublicInteractivePrompt => {
    const prompt = promptVWC.get();
    if (prompt !== null) {
      return { prompt: prompt.prompt, loading: false, error: null };
    }

    const error = errorVWC.get();
    return {
      prompt: null,
      loading: error === null,
      error,
    };
  });
};
