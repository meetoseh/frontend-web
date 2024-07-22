import { createWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { OsehScreen } from '../../models/Screen';
import { ChatMessageExamples } from './ChatMessageExamples';
import {
  ChatMessageExamplesAPIParams,
  ChatMessageExamplesMappedParams,
} from './ChatMessageExamplesParams';
import { ChatMessageExamplesResources } from './ChatMessageExamplesResources';

/**
 * An interstitial screen designed to highlight how to use the journal chat screen
 */
export const ChatMessageExamplesScreen: OsehScreen<
  'chat_message_examples',
  ChatMessageExamplesResources,
  ChatMessageExamplesAPIParams,
  ChatMessageExamplesMappedParams
> = {
  slug: 'chat_message_examples',
  paramMapper: (params) => ({
    ...params,
    __mapped: true,
  }),
  initInstanceResources: (ctx, screen, refreshScreen) => {
    return {
      ready: createWritableValueWithCallbacks(true),
      dispose: () => {},
    };
  },
  component: (props) => <ChatMessageExamples {...props} />,
};
