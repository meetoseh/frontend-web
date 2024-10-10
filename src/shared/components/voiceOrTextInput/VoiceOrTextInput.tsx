import { useContext } from 'react';
import {
  createVoiceNoteStateMachineForLocalUpload,
  VoiceNoteStateMachine,
} from '../../../user/core/screens/journal_chat/lib/createVoiceNoteStateMachine';
import { useMappedValueWithCallbacks } from '../../hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../hooks/useValueWithCallbacksEffect';
import { useWritableValueWithCallbacks, ValueWithCallbacks } from '../../lib/Callbacks';
import { setVWC } from '../../lib/setVWC';
import { RenderGuardedComponent } from '../RenderGuardedComponent';
import { VoiceOrTextInputText } from './VoiceOrTextInputText';
import { VoiceOrTextInputVoice } from './VoiceOrTextInputVoice';
import { LoginContext } from '../../contexts/LoginContext';
import { InterestsContext } from '../../contexts/InterestsContext';

export type VoiceOrTextInputProps = {
  /** The placeholder text to show when no text has been input */
  placeholder: string;
  /** The state of the input */
  value: ValueWithCallbacks<{ type: 'text'; value: string } | { type: 'voice' }>;
  /** Callback for when we can focus or blur the element */
  onFocuser?: (focuser: { focus: () => void; blur: () => void } | null) => void;
  /** The callback when the user changes the value in the input */
  onValueChanged: (v: { type: 'text'; value: string } | { type: 'voice' }) => void;
  /** The callback when the user submits the value */
  onSubmit: (
    v: { type: 'text'; value: string } | { type: 'voice'; voiceNote: VoiceNoteStateMachine }
  ) => void;
};

/**
 * Initially shows a text input with a mic button in the right. If they write something,
 * the mic is replaced with a send button and they can send text. If they press the mic
 * button, it switches to voice input. They can stop recording and cancel/send the voice
 * note.
 */
export const VoiceOrTextInput = (props: VoiceOrTextInputProps) => {
  const loginContext = useContext(LoginContext);
  const interestsContext = useContext(InterestsContext);
  const valueTypeVWC = useMappedValueWithCallbacks(props.value, (v) => v.type);
  const valueTextVWC = useMappedValueWithCallbacks(props.value, (v) =>
    v.type === 'text' ? v.value : ''
  );

  const voiceNoteVWC = useWritableValueWithCallbacks<VoiceNoteStateMachine | null>(() => null);

  useValueWithCallbacksEffect(props.value, (v) => {
    if (v.type !== 'voice') {
      return undefined;
    }

    const myNote = createVoiceNoteStateMachineForLocalUpload({
      loginContext,
      visitor: interestsContext.visitor,
      assignUID: () => {},
    });
    setVWC(voiceNoteVWC, myNote);
    return () => {
      const oldNote = voiceNoteVWC.get();
      if (Object.is(oldNote, myNote)) {
        setVWC(voiceNoteVWC, null);
        if (myNote.state.get().type !== 'released') {
          myNote.sendMessage({ type: 'release' });
        }
      }
    };
  });

  return (
    <RenderGuardedComponent
      props={valueTypeVWC}
      component={(valueType) =>
        valueType === 'text' ? (
          <VoiceOrTextInputText
            placeholder={props.placeholder}
            value={valueTextVWC}
            onValueChanged={(v) => props.onValueChanged({ type: 'text', value: v })}
            onRequestVoice={() => {
              props.onValueChanged({ type: 'voice' });
            }}
            onSubmit={() => {
              props.onSubmit({ type: 'text', value: valueTextVWC.get() });
            }}
          />
        ) : (
          <RenderGuardedComponent
            props={voiceNoteVWC}
            component={(voiceNote) =>
              voiceNote === null ? (
                <></>
              ) : (
                <VoiceOrTextInputVoice
                  onCancel={() => {
                    props.onValueChanged({ type: 'text', value: '' });
                  }}
                  onSend={(voiceNote) => {
                    if (Object.is(voiceNote, voiceNoteVWC.get())) {
                      setVWC(voiceNoteVWC, null);
                    }

                    props.onSubmit({ type: 'voice', voiceNote });
                  }}
                  voiceNote={voiceNote}
                />
              )
            }
          />
        )
      }
    />
  );
};
