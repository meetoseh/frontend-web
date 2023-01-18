import React, { PropsWithChildren, ReactElement, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../shared/ApiConstants';
import { kFormatter } from '../../../shared/lib/kFormatter';
import { JourneyStats } from '../hooks/useStats';
import { JourneyPromptProps } from '../models/JourneyPromptProps';
import styles from './PressJourneyPrompt.module.css';

/**
 * Renders the prompt section for a journey with a press prompt, i.e., the user can
 * press and hold a button (or space bar) to respond to the prompt. Shows the number
 * of people actively pressing
 */
export const PressJourneyPrompt = ({
  journeyUid,
  journeyJwt,
  sessionUid,
  prompt,
  journeyDurationSeconds,
  stats,
  journeyTime,
  loginContext,
}: JourneyPromptProps): ReactElement => {
  if (prompt.style !== 'press') {
    throw new Error('PressJourneyPrompt must be used with a press prompt');
  }

  const [pressSource, setPressSource] = useState<'mouse' | 'touch' | 'keyboard' | null>(null);

  const onPressStartOrEnd = useCallback(
    async (start: boolean) => {
      if (loginContext.state !== 'logged-in') {
        console.log('not sending press event; not logged in');
        return;
      }

      try {
        const response = await apiFetch(
          `/api/1/journeys/events/respond_press_prompt/${start ? 'start' : 'end'}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
              journey_uid: journeyUid,
              journey_jwt: journeyJwt,
              session_uid: sessionUid,
              journey_time: journeyTime.time.current / 1000,
              data: {},
            }),
          },
          loginContext
        );

        if (!response.ok) {
          throw response;
        }
      } catch (e) {
        if (e instanceof TypeError) {
          console.error('failed to send press event; could not connect to server:', e);
        } else if (e instanceof Response) {
          const data = await e.json();
          console.error('failed to send press event; server rejected request:', data);
        } else {
          console.error('failed to send press event; unknown error:', e);
        }
      }
    },
    [journeyUid, journeyJwt, sessionUid, journeyTime.time, loginContext]
  );

  const setPressSourceIfMatches = useCallback(
    (
      source: 'mouse' | 'touch' | 'keyboard' | null,
      expecting: 'mouse' | 'touch' | 'keyboard' | null
    ) => {
      setPressSource((currentSource) => {
        if (currentSource !== expecting) {
          return currentSource;
        }
        if (currentSource === null && source !== null) {
          onPressStartOrEnd(true);
        } else if (currentSource !== null && source === null) {
          onPressStartOrEnd(false);
        }
        return source;
      });
    },
    [onPressStartOrEnd]
  );

  const onMouseDown = useCallback(() => {
    setPressSourceIfMatches('mouse', null);
  }, [setPressSourceIfMatches]);

  const onMouseUp = useCallback(() => {
    setPressSourceIfMatches(null, 'mouse');
  }, [setPressSourceIfMatches]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setPressSourceIfMatches('touch', null);
    },
    [setPressSourceIfMatches]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setPressSourceIfMatches(null, 'touch');
    },
    [setPressSourceIfMatches]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ') {
        setPressSourceIfMatches('keyboard', null);
      }
    },
    [setPressSourceIfMatches]
  );

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ') {
        setPressSourceIfMatches(null, 'keyboard');
      }
    },
    [setPressSourceIfMatches]
  );

  return (
    <div className={styles.container}>
      <div className={styles.promptContainer}>
        <div className={styles.prompt}>{prompt.text}</div>
      </div>
      <div className={styles.buttonContainer}>
        <button
          className={`${styles.button} ${pressSource !== null ? styles.pressing : ''}`}
          type="button"
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}>
          <JuicyButton pressing={pressSource !== null} stats={stats} />
        </button>
      </div>
      <div className={styles.statsContainer}>
        <div className={styles.stats}>{getStatsText(pressSource !== null, stats)}</div>
      </div>
    </div>
  );
};

/**
 * A ripple effect causes circular waves to emenate from the outer
 * edge of the button
 */
type Ripple = 'weak' | 'strong';

const JuicyButton = ({
  pressing,
  stats,
}: {
  pressing: boolean;
  stats: JourneyStats;
}): ReactElement => {
  const innerSize = 75;
  const innerColor = 'rgba(255, 255, 255, 0.5)';
  const [innerBoxShadow, setInnerBoxShadow] = useState('none');
  const outerSize = 130;
  const outerColor = 'rgba(255, 255, 255, 0.25)';
  const outerBoxShadow = 'none';
  const [rippling, setRippling] = useState<Ripple | null>(null);

  useEffect(() => {
    if (pressing) {
      setInnerBoxShadow(
        '2px 0 3px 0 rgba(0, 0, 0, 0.2), 0 2px 3px 0 rgba(0, 0, 0, 0.2), -2px 0 3px 0 rgba(0, 0, 0, 0.2), 0 -2px 3px 0 rgba(0, 0, 0, 0.2)'
      );
      if (stats.pressActive !== null && stats.pressActive >= 101) {
        setRippling('strong');
      } else if (stats.pressActive !== null && stats.pressActive >= 11) {
        setRippling('weak');
      } else {
        setRippling(null);
      }
    } else {
      setInnerBoxShadow('none');
      setRippling(null);
    }
  }, [pressing, stats]);

  const outer = (
    <Circle size={outerSize} color={outerColor} boxShadow={outerBoxShadow}>
      <Circle size={innerSize} color={innerColor} boxShadow={innerBoxShadow}></Circle>
    </Circle>
  );

  if (rippling) {
    return (
      <RippleEffect size={outerSize} color={outerColor} strength={rippling}>
        {outer}
      </RippleEffect>
    );
  }
  return outer;
};

const Circle = ({
  size,
  color,
  boxShadow,
  children,
}: PropsWithChildren<{ size: number; color: string; boxShadow: string }>): ReactElement => {
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: boxShadow,
        borderRadius: '50%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'background-color 0.35s ease-in-out, box-shadow 0.35s ease-out',
      }}>
      {children}
    </div>
  );
};

const RippleEffect = ({
  size,
  color,
  strength,
  children,
}: PropsWithChildren<{ size: number; color: string; strength: Ripple }>): ReactElement => {
  const numRipples = strength === 'weak' ? 2 : 8;
  return (
    <div className={`${styles.rippleContainer} ${styles[`rippleContainer-${strength}`]}`}>
      <div className={styles.ripples}>
        {Array.from({ length: numRipples }).map((_, i) => {
          return <div key={i} className={`${styles.ripple} ${styles[`ripple-${i + 1}`]}`} />;
        })}
      </div>
      {children}
    </div>
  );
};

const getStatsText = (pressing: boolean, stats: JourneyStats): string | null => {
  if (stats.pressActive === null || stats.press === null) {
    return null;
  }

  if (pressing && stats.pressActive > 1) {
    if (stats.pressActive === 2) {
      return '1 person is resonating with you.';
    }
    return `${kFormatter(stats.pressActive - 1)} people are resonating with you.`;
  }

  if (stats.press === 1) {
    return `${stats.press} person has resonated.`;
  }

  return `${kFormatter(stats.press)} people have resonated.`;
};
