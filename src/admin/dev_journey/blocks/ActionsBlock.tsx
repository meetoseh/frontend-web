import { ReactElement, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { LoginContext } from '../../../shared/contexts/LoginContext';
import { BlockProps } from './BlockProps';

type ActionsBlockProps = BlockProps;

/**
 * Shows a block containing the actions that the user can take
 * in the journey. This is setup primarily for debugging purposes
 */
export const ActionsBlock = ({
  journeyRef,
  sessionUID,
  running,
  journeyTime,
}: ActionsBlockProps): ReactElement => {
  return (
    <>
      <div style={{ fontWeight: 700, textAlign: 'center' }}>actions</div>
      <Like
        journeyRef={journeyRef}
        sessionUID={sessionUID}
        running={running}
        journeyTime={journeyTime}
      />
      {(journeyRef.prompt.style === 'numeric' && (
        <NumericPrompt
          journeyRef={journeyRef}
          sessionUID={sessionUID}
          running={running}
          journeyTime={journeyTime}
        />
      )) || <div>unsupported prompt</div>}
    </>
  );
};

const Like = ({
  journeyRef,
  sessionUID,
  running,
  journeyTime,
}: ActionsBlockProps): ReactElement => {
  const [saving, setSaving] = useState(false);
  const loginContext = useContext(LoginContext);

  const doLike = useCallback(async () => {
    setSaving(true);
    try {
      const response = await apiFetch(
        '/api/1/journeys/events/like',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            journey_uid: journeyRef.uid,
            journey_jwt: journeyRef.jwt,
            session_uid: sessionUID,
            journey_time: journeyTime,
            data: {},
          }),
        },
        loginContext
      );
      if (!response.ok) {
        const text = await response.text();
        console.log('Failed to like journey', response, text);
        return;
      }
    } finally {
      setSaving(false);
    }
  }, [journeyRef, sessionUID, journeyTime, loginContext]);

  return (
    <>
      <button
        style={{ padding: '2px 4px' }}
        disabled={
          !running || saving || journeyTime <= 0 || journeyTime >= journeyRef.durationSeconds
        }
        onClick={(e) => {
          e.preventDefault();
          doLike();
        }}>
        Like
      </button>
    </>
  );
};

const NumericPrompt = ({
  journeyRef,
  sessionUID,
  running,
  journeyTime,
}: ActionsBlockProps): ReactElement => {
  const [value, setValue] = useState<number | null>(null);
  const [savingValue, setSavingValue] = useState(false);
  const loginContext = useContext(LoginContext);

  useEffect(() => {
    if (!running || sessionUID === null) {
      setValue(null);
    }
    return () => {};
  }, [sessionUID, running]);

  const updateValue = useCallback(
    async (newValue: number) => {
      setSavingValue(true);
      try {
        const response = await apiFetch(
          '/api/1/journeys/events/respond_numeric_prompt',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journeyRef.uid,
              journey_jwt: journeyRef.jwt,
              session_uid: sessionUID,
              journey_time: journeyTime,
              data: {
                rating: newValue,
              },
            }),
          },
          loginContext
        );
        if (!response.ok) {
          const text = await response.text();
          console.log('Error updating value', text);
          return;
        }
        setValue(newValue);
      } finally {
        setSavingValue(false);
      }
    },
    [journeyRef, journeyTime, sessionUID, loginContext]
  );

  const options = [];
  if (value === null) {
    options.push(
      <option key="not-selected" value="not-selected">
        Choose One
      </option>
    );
  }
  for (let i = journeyRef.prompt.min; i <= journeyRef.prompt.max; i++) {
    options.push(
      <option key={i.toString()} value={i}>
        {i}
      </option>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25em' }}>
      <div>numeric:</div>
      <select
        disabled={
          !running || savingValue || journeyTime <= 0 || journeyTime >= journeyRef.durationSeconds
        }
        value={value === null ? 'not-selected' : value.toString()}
        style={{ flexGrow: '1' }}
        onChange={(e) => {
          const newValue = parseInt(e.target.value);
          if (isNaN(newValue)) {
            return;
          }
          updateValue(newValue);
        }}>
        {options}
      </select>
    </div>
  );
};
