import { ReactElement, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import {
  InteractivePrompt,
  interactivePromptKeyMap,
} from '../../user/interactive_prompt/models/InteractivePrompt';
import { apiFetch } from '../ApiConstants';
import { describeError } from '../forms/ErrorBlock';
import { LoginContext } from '../LoginContext';

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
export const usePublicInteractivePrompt = ({
  identifier,
  load,
}: PublicInteractivePromptProps): PublicInteractivePrompt => {
  const loginContext = useContext(LoginContext);
  const [prompt, setPrompt] = useState<{ identifier: string; prompt: InteractivePrompt } | null>(
    null
  );
  const [error, setError] = useState<ReactElement | null>(null);

  const running = useRef<Promise<{ identifier: string; prompt: InteractivePrompt } | null> | null>(
    null
  );

  useEffect(() => {
    if (loginContext.state !== 'logged-in') {
      return;
    }

    if (prompt?.identifier === identifier) {
      return;
    }

    let active = true;
    fetchPrompt();
    return () => {
      active = false;
    };

    async function fetchPromptInner() {
      const response = await apiFetch(
        '/api/1/interactive_prompts/start_public',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            identifier,
          }),
        },
        loginContext
      );

      if (!response.ok) {
        throw response;
      }

      const data = await response.json();
      const parsed = convertUsingKeymap(data, interactivePromptKeyMap);
      const res = { identifier, prompt: parsed };
      if (active) {
        setPrompt(res);
      }
      return res;
    }

    async function fetchPrompt() {
      let last: { identifier: string; prompt: InteractivePrompt } | null = null;
      while (running.current && active) {
        last = await running.current;
      }
      if (!active) {
        return;
      }
      if (load === false) {
        setPrompt(null);
        setError(null);
        return;
      }
      if (last !== null && last.identifier === identifier) {
        setPrompt(last);
        return;
      }
      setError(null);
      running.current = (async () => {
        try {
          const res = await fetchPromptInner();
          running.current = null;
          return res;
        } catch (e) {
          const error = await describeError(e);
          if (active) {
            setError(error);
          }
        }
        return null;
      })();
    }
  }, [identifier, loginContext, prompt, load]);

  return useMemo<PublicInteractivePrompt>(() => {
    const actualPrompt = prompt?.identifier === identifier ? prompt.prompt : null;

    if (actualPrompt !== null) {
      return {
        prompt: actualPrompt,
        loading: false,
        error: null,
      };
    }
    return {
      prompt: null,
      loading: error === null,
      error,
    };
  }, [identifier, prompt, error]);
};
