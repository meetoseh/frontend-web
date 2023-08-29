import { ReactElement, useContext, useEffect } from 'react';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import {
  InteractivePrompt,
  interactivePromptKeyMap,
} from '../../user/interactive_prompt/models/InteractivePrompt';
import { apiFetch } from '../ApiConstants';
import { describeError } from '../forms/ErrorBlock';
import { LoginContext } from '../contexts/LoginContext';
import {
  VariableStrategyProps,
  useVariableStrategyPropsAsValueWithCallbacks,
} from '../anim/VariableStrategyProps';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../lib/Callbacks';
import { useMappedValuesWithCallbacks } from './useMappedValuesWithCallbacks';

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
      error: ReactElement | null;
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
  const loginContext = useContext(LoginContext);
  const promptVWC = useWritableValueWithCallbacks<{
    identifier: string;
    prompt: InteractivePrompt;
  } | null>(() => null);
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);

  useEffect(() => {
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
      if (props.load === false || loginContext.state !== 'logged-in') {
        if (promptVWC.get() !== null) {
          promptVWC.set(null);
          promptVWC.callbacks.call(undefined);
        }
        return;
      }

      const old = promptVWC.get();
      if (old !== null && old.identifier === props.identifier) {
        return;
      }

      if (promptVWC.get() !== null) {
        promptVWC.set(null);
        promptVWC.callbacks.call(undefined);
      }

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
      promptVWC.set({ identifier: props.identifier, prompt: parsed });
      promptVWC.callbacks.call(undefined);
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
        if (errorVWC.get() !== null) {
          errorVWC.set(null);
          errorVWC.callbacks.call(undefined);
        }
        try {
          await handleProps(propsVWC.get());
        } catch (e) {
          const described = await describeError(e);
          if (!queued) {
            errorVWC.set(described);
            errorVWC.callbacks.call(undefined);
          }
        }
      }
      running = false;
    }
  }, [propsVWC, errorVWC, promptVWC, loginContext]);

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
