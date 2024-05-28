import { convertUsingMapper } from '../../../../admin/crud/CrudFetcher';
import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { interactivePromptKeyMap } from '../../../interactive_prompt/models/InteractivePrompt';
import { initBackground } from '../../lib/initBackground';
import { OsehScreen } from '../../models/Screen';
import { screenImageKeyMap } from '../../models/ScreenImage';
import { InteractivePrompt } from './InteractivePrompt';
import {
  InteractivePromptAPIParams,
  InteractivePromptMappedParams,
} from './InteractivePromptParams';
import { InteractivePromptResources } from './InteractivePromptResources';

/**
 * An interactive prompt (shows all users responses) with an optional image
 * background
 */
export const InteractivePromptScreen: OsehScreen<
  'interactive_prompt',
  InteractivePromptResources,
  InteractivePromptAPIParams,
  InteractivePromptMappedParams
> = {
  slug: 'interactive_prompt',
  paramMapper: (params) => ({
    ...params,
    prompt: convertUsingMapper(params.prompt, interactivePromptKeyMap),
    background:
      params.background === null ? null : convertUsingMapper(params.background, screenImageKeyMap),
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    const [background, cleanupBackground] = initBackground(ctx, screen, refreshScreen);

    return {
      ready: createWritableValueWithCallbacks(true),
      background,
      dispose: () => {
        cleanupBackground();
      },
    };
  },
  component: (props) => <InteractivePrompt {...props} />,
};
