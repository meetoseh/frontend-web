import { ReactElement, useCallback, useState } from 'react';
import { HistoricalEvents, useHistoricalEventCallback } from './hooks/useHistoricalEvents';
import { LiveEvents, useLiveEventCallback } from './hooks/useLiveEvents';
import {
  JourneyEvent,
  JoinData,
  LeaveData,
  NumericPromptResponseData,
  ColorPromptResponseData,
  WordPromptResponseData,
} from './models/JourneyEvent';
import styles from './JourneyChat.module.css';
import { Prompt, WordPrompt } from './Journey';
import { OsehImage } from '../../shared/OsehImage';

type JourneyChatProps = {
  /**
   * The feed of historical events
   */
  historicalEvents: HistoricalEvents;
  /**
   * The feed of live events
   */
  liveEvents: LiveEvents;
  /**
   * The prompt of the journey, used for formatting some messages
   */
  prompt: Prompt;
};

export const JourneyChat = ({
  historicalEvents,
  liveEvents,
  prompt,
}: JourneyChatProps): ReactElement => {
  const [chat, setChat] = useState<ReactElement[]>([]);

  const onMessage = useCallback(
    (event: JourneyEvent) => {
      if (!isChatEvent(event)) {
        return;
      }

      const item = <ChatMessage key={event.uid} prompt={prompt} event={event} />;
      setChat((oldChat) => {
        const newChat = [...oldChat, item];
        if (newChat.length > 3) {
          newChat.shift();
        }
        return newChat;
      });
    },
    [prompt]
  );

  useHistoricalEventCallback(historicalEvents, onMessage);
  useLiveEventCallback(liveEvents, onMessage);

  return <div className={styles.container}>{chat}</div>;
};

const ChatMessage = ({ prompt, event }: { prompt: Prompt; event: JourneyEvent }): ReactElement => {
  const text = getMessageText(prompt, event);
  if (text === null) {
    return <></>;
  }
  return (
    <div className={styles.chatMessage}>
      {event.icon && (
        <div className={styles.chatMessageIcon}>
          <OsehImage
            uid={event.icon.uid}
            jwt={event.icon.jwt}
            displayWidth={45}
            displayHeight={45}
            alt=""
          />
        </div>
      )}
      <div className={styles.chatMessageText}>{text}</div>
    </div>
  );
};

const getMessageText = (prompt: Prompt, event: JourneyEvent): string | null => {
  if (event.evtype === 'join') {
    const data = event.data as JoinData;
    return `${data.name} joined this class`;
  } else if (event.evtype === 'leave') {
    const data = event.data as LeaveData;
    return `${data.name} left`;
  } else if (event.evtype === 'like') {
    return null;
  } else if (event.evtype === 'numeric_prompt_response') {
    const data = event.data as NumericPromptResponseData;
    return data.rating.toLocaleString();
  } else if (event.evtype === 'press_prompt_start_response') {
    return 'I relate.';
  } else if (event.evtype === 'press_prompt_end_response') {
    return null;
  } else if (event.evtype === 'color_prompt_response') {
    const data = event.data as ColorPromptResponseData;
    return (data.index + 1).toLocaleString();
  } else if (event.evtype === 'word_prompt_response') {
    const data = event.data as WordPromptResponseData;
    const wordPrompt = prompt as WordPrompt;
    return wordPrompt.options[data.index];
  } else {
    return null;
  }
};

const chatEventsTypes: Record<string, boolean | undefined> = {
  join: true,
  leave: true,
  numeric_prompt_response: true,
  press_prompt_start_response: true,
  color_prompt_response: true,
  word_prompt_response: true,
};

const isChatEvent = (event: JourneyEvent): boolean => {
  return !!chatEventsTypes[event.evtype];
};
