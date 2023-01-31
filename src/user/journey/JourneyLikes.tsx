import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { JourneyTime } from './hooks/useJourneyTime';
import { easeIn, easeInOut } from '../../shared/lib/Bezier';
import '../../assets/fonts.css';
import styles from './JourneyLikes.module.css';
import { kFormatter } from '../../shared/lib/kFormatter';
import { apiFetch } from '../../shared/ApiConstants';
import { LoginContextValue } from '../../shared/LoginContext';

type JourneyLikesProps = {
  /**
   * The uid of the journey, for adding like events
   */
  journeyUid: string;
  /**
   * The jwt which allows adding like events to the session within the journey
   */
  journeyJwt: string;
  /**
   * The uid of the session within the journey, for adding like events
   */
  sessionUid: string;
  /**
   * The journey time, so we specify the correct time for like events.
   */
  journeyTime: JourneyTime;
  /**
   * The number of likes the journey has, from the statistics. We will add
   * hearts based on the rate of change of likes and immediately when the
   * user clicks the like button.
   */
  likes: number;
  /**
   * The login context for sending like events
   */
  loginContext: LoginContextValue;
};

/**
 * Allows the user to like the journey, repeatedly, as well as show hearts
 * when they or others like the journey (without excessively many hearts
 * for very popular journeys)
 *
 * This uses a token bucket strategy for rate limiting the number of hearts.
 */
export const JourneyLikes = ({
  journeyUid,
  journeyJwt,
  sessionUid,
  journeyTime,
  likes,
  loginContext,
}: JourneyLikesProps): ReactElement => {
  const hearts = useRef<ComputedHeart[]>([]);
  const minLikesRef = useRef(likes);

  const likesRef = useRef(likes);
  likesRef.current = likes;

  const numOurHearts = useRef(0); // so we don't get 2 hearts when we heart

  const setHeartsCounter = useState(0)[1]; // incremented when hearts changes

  const pushLogicalHeart = useRef<((logicalHeart: Heart) => void) | null>(null);

  useEffect(() => {
    let active = true;
    let lastEffectiveNumLikes = 0;

    const maxHeartTokens = 2;
    const heartTokenEveryMS = 1000;
    let heartTokens = maxHeartTokens;
    let lastHeartTokenAt = Number.MIN_SAFE_INTEGER;
    const logicalHearts: Heart[] = [];

    pushLogicalHeart.current = (logicalHeart) => {
      logicalHearts.push(logicalHeart);
    };

    const tryConsumeHeartToken = (time: DOMHighResTimeStamp): boolean => {
      let timeSinceLastToken = Math.max(time - lastHeartTokenAt, 0);
      let bonusTokens = Math.floor(timeSinceLastToken / heartTokenEveryMS);
      heartTokens += bonusTokens;

      if (heartTokens >= maxHeartTokens) {
        heartTokens = maxHeartTokens - 1;
        lastHeartTokenAt = time;
        return true;
      }

      lastHeartTokenAt += heartTokenEveryMS * bonusTokens;
      if (heartTokens > 0) {
        heartTokens--;
        return true;
      }

      return false;
    };

    const onTimeChanged = (oldTime: DOMHighResTimeStamp, newTime: DOMHighResTimeStamp) => {
      if (!active) {
        return;
      }

      if (logicalHearts.length > 0) {
        const newHearts = logicalHearts.map((logicalHeart) => computeHeart(logicalHeart, newTime));
        let numDoneHearts = 0;
        for (; numDoneHearts < newHearts.length; numDoneHearts++) {
          if (newHearts[numDoneHearts].opacity > 0) {
            break;
          }
        }
        if (numDoneHearts > 0) {
          logicalHearts.splice(0, numDoneHearts);
          newHearts.splice(0, numDoneHearts);
        }
        hearts.current = newHearts;
        setHeartsCounter((c) => c + 1);
      }

      let effectiveNumLikes = likesRef.current - numOurHearts.current;
      if (effectiveNumLikes <= lastEffectiveNumLikes) {
        return;
      }
      lastEffectiveNumLikes = effectiveNumLikes;

      if (!tryConsumeHeartToken(newTime)) {
        return;
      }

      logicalHearts.push(spawnHeart(false, newTime));
    };

    const unmount = () => {
      if (!active) {
        return;
      }

      active = false;
      for (
        let i = Math.min(predictedIndex, journeyTime.onTimeChanged.current.length - 1);
        i >= 0;
        i--
      ) {
        if (journeyTime.onTimeChanged.current[i] === onTimeChanged) {
          journeyTime.onTimeChanged.current.splice(i, 1);
          break;
        }
      }
    };

    const predictedIndex = journeyTime.onTimeChanged.current.length;
    journeyTime.onTimeChanged.current.push(onTimeChanged);

    return unmount;
  }, [journeyTime.onTimeChanged, setHeartsCounter]);

  const onLike = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      if (pushLogicalHeart.current !== null) {
        pushLogicalHeart.current(spawnHeart(true, journeyTime.time.current));
        minLikesRef.current = Math.max(likesRef.current, minLikesRef.current) + 1;
        numOurHearts.current += 1;
      }

      if (loginContext.state !== 'logged-in') {
        console.log('not actually liking since not logged in');
        return;
      }

      try {
        await apiFetch(
          '/api/1/journeys/events/like',
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
      } catch (e) {
        if (e instanceof TypeError) {
          console.error('error liking journey, failed to connect to server: ', e);
        } else if (e instanceof Response) {
          const data = await e.json();
          console.error('error liking journey, server rejected request: ', data);
        } else {
          console.error('error liking journey, unknown: ', e);
        }
      }
    },
    [journeyUid, journeyJwt, sessionUid, journeyTime.time, loginContext]
  );

  return (
    <div className={styles.container}>
      <div className={styles.heartsContainer}>
        {hearts.current.map((heart, idx) => (
          <div
            key={idx}
            className={`${styles.heart} ${heart.isOurs ? styles.ourHeart : ''}`}
            style={{
              transform: `translate(${heart.x}px, ${heart.y}px)`,
              opacity: heart.opacity,
            }}></div>
        ))}
      </div>
      <div className={styles.content}>
        <button className={styles.button} type="button" onClick={onLike}>
          <div className={styles.buttonIconContainer}>
            <div className={styles.heart}></div>
          </div>
          <div className={styles.buttonTextContainer}>
            {kFormatter(Math.max(likes, minLikesRef.current))}
          </div>
        </button>
      </div>
    </div>
  );
};

const TWO_PI_OVER_1000 = (2 * Math.PI) / 1000;

/**
 * Hearts follow a sinusoidal path, where
 *
 * ```txt
 * y = [cubic-bezier(0.42, 0, 1, 1) over opacityDuration] * yMovement + yInitial`
 * x = sin(t * xPeriod * (2pi/1000)) * xAmplitude + xOffset
 * opacity = 1 - [cubic-bezier(0.42, 0, 0.58, 1) over opacityDuration]
 * ```
 *
 * Note the opacity is equivalent to an ease-in-out curve and the y is equivalent to an
 * ease-in curve.
 *
 * To avoid rounding errors, we store when it started and recompute the position, rather
 * than doing deltas
 */
type Heart = {
  /**
   * If this is "our" heart, i.e., caused by the user pressing the like button.
   * These may be shown differently to reassure the user that their action
   * was successful.
   */
  isOurs: boolean;

  /**
   * The journey time when the heart was spawned, in milliseconds
   */
  spawnedAt: DOMHighResTimeStamp;

  /**
   * The initial y transform for the heart in pixels, typically negative
   */
  yInitial: number;

  /**
   * The total movement of the heart in the y direction, in pixels, over
   * the course of its lifetime.
   */
  yMovement: number;

  /**
   * The rate at which the heart oscillates around the y axis, where a period of 1
   * means it oscillates once per second, 0.5 is once every 2 seconds, etc. Note that
   * the maximum speed depends both on the period and the amplitude.
   */
  xPeriod: number;

  /**
   * The maximum x-offset of the heart from its initial position, in pixels.
   *
   * Computing the derivative of x with respect to time, we get
   * xPeriod * (2pi/1000) * xAmplitude * cos(t * xPeriod * (2pi/1000)),
   * hence the period and the amplitude equally affect the maximum speed.
   */
  xAmplitude: number;

  /**
   * The initial x-offset of the heart from its initial position, in pixels.
   */
  xOffset: number;

  /**
   * The fractional seconds that the heart should take to fade out, where 1 is
   * one second, 0.5 is half a second, etc. The opacity ease is fixed to the
   * standard ease-in curve.
   */
  opacityDuration: number;
};

/**
 * Spawns a new heart with random properties
 */
const spawnHeart = (isOurs: boolean, now: DOMHighResTimeStamp): Heart => {
  const minOpacityDuration = 2.5;
  const maxOpacityDuration = 4.25;
  const maxYMovement = 150;
  const minPeakXVelocity = 0.064;
  const maxPeakXVelocity = 0.096;

  const yInitial = -20 - Math.random() * 24;
  const opacityDuration =
    minOpacityDuration + Math.random() * (maxOpacityDuration - minOpacityDuration);
  const yMovement = -(maxYMovement + yInitial);

  const peakXVelocity = minPeakXVelocity + Math.random() * (maxPeakXVelocity - minPeakXVelocity);
  const xPeriod = Math.sqrt(peakXVelocity / TWO_PI_OVER_1000) * (0.125 + Math.random() * 0.1);
  const xAmplitude = peakXVelocity / (xPeriod * TWO_PI_OVER_1000);

  return {
    isOurs,
    spawnedAt: now,
    yInitial,
    yMovement,
    xPeriod,
    xAmplitude,
    xOffset: -8 + Math.random() * 16,
    opacityDuration,
  };
};

/**
 * A heart with a set position and opacity, ready to be rendered. The position
 * is relative to the standard heart location (i.e., the translateX and translateY
 * transformation)
 */
type ComputedHeart = {
  /**
   * The x position of the heart, in pixels
   */
  x: number;
  /**
   * The y position of the heart, in pixels
   */
  y: number;
  /**
   * The opacity of the heart, where 1 is fully opaque and 0 is fully transparent
   */
  opacity: number;
  /**
   * If this is our heart, i.e., caused by the user pressing the like button.
   */
  isOurs: boolean;
};

/**
 * Computes the properties of the given heart at the given journey time
 *
 * @param heart The heart
 * @param now The journey time in milliseconds
 * @returns The computed heart
 */
const computeHeart = (heart: Heart, now: DOMHighResTimeStamp): ComputedHeart => {
  return {
    x: computeX(heart, now),
    y: computeY(heart, now),
    opacity: computeOpacity(heart, now),
    isOurs: heart.isOurs,
  };
};

/**
 * Computes the appropriate opacity for the given heart at the given journey time
 *
 * @param heart The heart
 * @param now The journey time in milliseconds
 * @returns The opacity, where 1 is fully opaque and 0 is fully transparent
 */
const computeOpacity = (heart: Heart, now: DOMHighResTimeStamp): number => {
  const secondsSince = (now - heart.spawnedAt) / 1000;
  if (secondsSince <= 0) {
    return 1;
  }
  if (secondsSince >= heart.opacityDuration) {
    return 0;
  }

  return 1 - easeInOut.y_x(secondsSince / heart.opacityDuration);
};

/**
 * Computes the y-translation of the heart at the given journey time
 *
 * @param heart The heart
 * @param now The journey time in milliseconds
 * @returns The y-translation, in pixels
 */
const computeY = (heart: Heart, now: DOMHighResTimeStamp): number => {
  const secondsSince = (now - heart.spawnedAt) / 1000;
  if (secondsSince <= 0) {
    return heart.yInitial;
  }
  if (secondsSince >= heart.opacityDuration) {
    return heart.yInitial + heart.yMovement;
  }

  return heart.yInitial + heart.yMovement * easeIn.y_x(secondsSince / heart.opacityDuration);
};

/**
 * Computes the x-translation of the heart at the given journey time
 *
 * @param heart The heart
 * @param now The journey time in milliseconds
 * @returns The x-translation, in pixels
 */
const computeX = (heart: Heart, now: DOMHighResTimeStamp): number => {
  const msSince = now - heart.spawnedAt;
  return heart.xOffset + heart.xAmplitude * Math.sin(msSince * heart.xPeriod * TWO_PI_OVER_1000);
};
