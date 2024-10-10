import { ReactElement } from 'react';
import { useMappedValueWithCallbacks } from '../../hooks/useMappedValueWithCallbacks';
import { useWritableValueWithCallbacks, ValueWithCallbacks } from '../../lib/Callbacks';
import { OsehColors } from '../../OsehColors';
import { Microphone } from '../icons/Microphone';
import { Send } from '../icons/Send';
import { RESIZING_TEXT_AREA_ICON_SETTINGS, ResizingTextArea } from '../ResizingTextArea';
import { useValueWithCallbacksEffect } from '../../hooks/useValueWithCallbacksEffect';

export type VoiceOrTextInputTextProps = {
  /** The placeholder text to show when no text has been input */
  placeholder: string;
  /** The current text in the input */
  value: ValueWithCallbacks<string>;
  /** Callback for when we can focus or blur the element */
  onFocuser?: (focuser: { focus: () => void; blur: () => void } | null) => void;
  /** The callback when the user changes the value in the input */
  onValueChanged: (v: string) => void;
  /** The callback when the user taps to switch to voice */
  onRequestVoice: () => void;
  /** The callback when the user presses enter */
  onSubmit: () => void;
};

/**
 * Shows an input area that allows the user to enter text or switch to voice input
 * when no text is entered. After writing text, the microphone switches to a submit
 * button that sends the text.
 *
 * This is not generally used directly, but instead as a subcomponent of
 * VoiceOrTextInput which manages the states for you.
 */
export const VoiceOrTextInputText = (props: VoiceOrTextInputTextProps) => {
  const valueIsEmptyVWC = useMappedValueWithCallbacks(props.value, (v) => v === '');
  const submitVWC = useMappedValueWithCallbacks(
    valueIsEmptyVWC,
    (isEmpty): { icon: ReactElement; onClick: () => void } => {
      if (isEmpty) {
        return {
          icon: (
            <Microphone color={OsehColors.v4.primary.light} {...RESIZING_TEXT_AREA_ICON_SETTINGS} />
          ),
          onClick: props.onRequestVoice,
        };
      }
      return {
        icon: (
          <Send
            color={OsehColors.v4.primary.light}
            color2={OsehColors.v4.primary.dark}
            {...RESIZING_TEXT_AREA_ICON_SETTINGS}
          />
        ),
        onClick: props.onSubmit,
      };
    }
  );
  const refVWC = useWritableValueWithCallbacks<HTMLTextAreaElement | null>(() => null);
  useValueWithCallbacksEffect(refVWC, (r) => {
    props.onFocuser?.(r);
    return undefined;
  });
  return (
    <ResizingTextArea
      variant="dark"
      placeholder={props.placeholder}
      value={props.value}
      onValueChanged={props.onValueChanged}
      submit={submitVWC}
      enterBehavior="submit-unless-shift"
      refVWC={refVWC}
    />
  );
};
