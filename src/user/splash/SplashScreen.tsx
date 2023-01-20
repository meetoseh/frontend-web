import {
  CSSProperties,
  Dispatch,
  MutableRefObject,
  ReactElement,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useFullHeight } from '../../shared/hooks/useFullHeight';
import styles from './SplashScreen.module.css';
import brandmark from './assets/brandmark.lottie.json';
import wordmark from './assets/wordmark.lottie.json';
import { Player } from '@lottiefiles/react-lottie-player';
import { AnimationItem } from 'lottie-web';
import { useWindowSize } from '../../shared/hooks/useWindowSize';

const BRANDMARK_HOLD_TIME_MS = { forward: 750, backward: 500 };
const BRANDMARK_WIDTH = (windowSize: { width: number; height: number }): number =>
  Math.min(0.75 * windowSize.width, 0.75 * windowSize.height, 250);
const BRANDMARK_NATURAL_ASPECT_RATIO = 1341 / 1080;

const WORDMARK_HOLD_TIME_MS = { forward: 750, backward: 500 };
const WORDMARK_WIDTH = (windowSize: { width: number; height: number }): number =>
  Math.min(0.75 * windowSize.width, 0.75 * windowSize.height, 163);
const WORDMARK_NATURAL_ASPECT_RATIO = 1407 / 615;

type SplashScreenProps = {
  /**
   * The style to use for the spinner. Defaults to 'brandmark'
   */
  type?: 'wordmark' | 'brandmark' | undefined;
};

export const SplashScreen = ({ type = undefined }: SplashScreenProps): ReactElement => {
  const realStyle = type ?? 'brandmark';
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<AnimationItem>();
  const [playerStyle, setPlayerStyle] = useState<CSSProperties>({});
  const [playerRefCounter, setPlayerRefCounter] = useState(0);
  const windowSize = useWindowSize();

  const setPlayerRef = useCallback((player: AnimationItem) => {
    playerRef.current = player;
    setPlayerRefCounter((c) => c + 1);
  }, []);

  useFullHeight({ element: containerRef, attribute: 'minHeight' });
  useForwardBackwardEffect({
    style: realStyle,
    expectedStyle: 'brandmark',
    playerRef,
    windowSize,
    playerRefCounter,
    setPlayerStyle,
    naturalAspectRatio: BRANDMARK_NATURAL_ASPECT_RATIO,
    desiredWidth: BRANDMARK_WIDTH,
    holdTime: BRANDMARK_HOLD_TIME_MS,
  });
  useForwardBackwardEffect({
    style: realStyle,
    expectedStyle: 'wordmark',
    playerRef,
    windowSize,
    playerRefCounter,
    setPlayerStyle,
    naturalAspectRatio: WORDMARK_NATURAL_ASPECT_RATIO,
    desiredWidth: WORDMARK_WIDTH,
    holdTime: WORDMARK_HOLD_TIME_MS,
  });

  return (
    <div className={styles.container} ref={containerRef}>
      <Player
        lottieRef={setPlayerRef}
        src={realStyle === 'brandmark' ? brandmark : wordmark}
        keepLastFrame={true}
        style={playerStyle}
      />
    </div>
  );
};

const useForwardBackwardEffect = ({
  style,
  expectedStyle,
  playerRef,
  windowSize,
  playerRefCounter,
  setPlayerStyle,
  naturalAspectRatio,
  desiredWidth,
  holdTime,
}: {
  style: 'wordmark' | 'brandmark';
  expectedStyle: 'wordmark' | 'brandmark';
  playerRef: MutableRefObject<AnimationItem | undefined>;
  windowSize: { width: number; height: number };
  playerRefCounter: number;
  setPlayerStyle: Dispatch<SetStateAction<CSSProperties>>;
  naturalAspectRatio: number;
  desiredWidth: (windowSize: { width: number; height: number }) => number;
  holdTime: { forward: number; backward: number };
}) => {
  useEffect(() => {
    if (style !== expectedStyle) {
      return;
    }

    const player = playerRef.current;
    if (player === null || player === undefined) {
      return;
    }

    const desWidth = Math.floor(desiredWidth(windowSize));
    setPlayerStyle({
      width: `${desWidth}px`,
      height: `${desWidth / naturalAspectRatio}px`,
    });

    let state:
      | 'loading'
      | 'forward'
      | 'holding-after-forward'
      | 'backward'
      | 'holding-after-backward' = 'loading';
    let holdTimeout: NodeJS.Timeout | null = null;
    if (player.isLoaded) {
      state = 'forward';
      player.setDirection(1);
      player.goToAndPlay(0, true);
    }

    const onLoad = () => {
      if (state !== 'loading') {
        return;
      }

      player.removeEventListener('data_ready', onLoad);
      player.goToAndPlay(0, true);
      state = 'forward';
      player.addEventListener('complete', onComplete);
    };

    const onComplete = () => {
      if (state !== 'forward' && state !== 'backward') {
        return;
      }

      player.pause();
      holdTimeout = setTimeout(onHoldFinished, holdTime[state]);
      state = state === 'forward' ? 'holding-after-forward' : 'holding-after-backward';
      player.removeEventListener('complete', onComplete);
    };

    const onHoldFinished = () => {
      if (state !== 'holding-after-forward' && state !== 'holding-after-backward') {
        return;
      }

      holdTimeout = null;

      if (state === 'holding-after-forward') {
        player.setDirection(-1);
        player.play();
        state = 'backward';
      } else {
        player.setDirection(1);
        player.play();
        state = 'forward';
      }

      player.addEventListener('complete', onComplete);
    };

    if (state === 'loading') {
      player.addEventListener('data_ready', onLoad);
    } else {
      player.addEventListener('complete', onComplete);
    }

    return () => {
      if (holdTimeout !== null) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
      }

      // not sure what the correct solution is here, but the player doesn't
      // want us to call removeEventListener once it's been destroyed
      if (player.renderer === null) {
        return;
      }

      if (state === 'loading') {
        player.removeEventListener('data_ready', onLoad);
      }

      if (state === 'forward' || state === 'backward') {
        player.removeEventListener('complete', onComplete);
      }
    };
  }, [
    style,
    playerRefCounter,
    windowSize,
    desiredWidth,
    holdTime,
    naturalAspectRatio,
    playerRef,
    setPlayerStyle,
    expectedStyle,
  ]);
};
