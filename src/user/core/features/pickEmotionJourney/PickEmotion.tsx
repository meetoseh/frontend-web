import {
  MutableRefObject,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { PickEmotionJourneyResources } from './PickEmotionJourneyResources';
import { PickEmotionJourneyState } from './PickEmotionJourneyState';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import {
  ProfilePicturesState,
  ProfilePicturesStateChangedEvent,
  ProfilePicturesStateRef,
} from '../../../interactive_prompt/hooks/useProfilePictures';
import {
  Callbacks,
  ValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';
import styles from './PickEmotion.module.css';
import { ErrorBlock } from '../../../../shared/forms/ErrorBlock';
import { Button } from '../../../../shared/forms/Button';
import { ProfilePictures } from '../../../interactive_prompt/components/ProfilePictures';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import {
  BezierAnimator,
  TrivialAnimator,
  inferAnimators,
} from '../../../../shared/anim/AnimationLoop';
import { ease } from '../../../../shared/lib/Bezier';
import { useAnimatedValueWithCallbacks } from '../../../../shared/anim/useAnimatedValueWithCallbacks';

/**
 * Ensures we display at least 12 options, faking the rest if necessary.
 */
const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'dev';

/**
 * Allows the user to pick an emotion and then go to that class
 */
export const PickEmotion = ({
  state,
  resources,
  gotoJourney,
}: FeatureComponentProps<PickEmotionJourneyState, PickEmotionJourneyResources> & {
  gotoJourney: () => void;
}): ReactElement => {
  const loginContext = useContext(LoginContext);
  const words = useMemo(() => {
    const res = resources.options?.words?.map((opt) => opt.word) ?? [];
    if (isDevelopment) {
      while (res.length < 12) {
        res.push('faked');
      }
    }
    return res;
  }, [resources.options]);
  const [tentativelyPressedIndex, setTentativelyPressedIndex] = useState<number | null>(null);
  const pressed = useMemo<{ index: number; votes: number | null } | null>(() => {
    if (resources.options === null) {
      return null;
    }

    if (resources.selected !== null) {
      const sel = resources.selected;

      const idx = resources.options.words.findIndex((opt) => opt.word === sel.word.word);
      if (idx < 0) {
        return null;
      }

      return {
        index: idx,
        votes: resources.selected.numVotes,
      };
    }

    if (tentativelyPressedIndex !== null) {
      return {
        index: tentativelyPressedIndex,
        votes: null,
      };
    }

    return null;
  }, [resources.selected, resources.options, tentativelyPressedIndex]);

  const windowSize = useWindowSize();

  const onWordClick = useCallback(
    (word: string, index: number) => {
      setTentativelyPressedIndex(index);
      resources.onSelect.call(undefined, resources.options!.words[index]);
    },
    [resources.onSelect, resources.options]
  );

  const onGotoFavoritesClick = '/favorites';

  const onGotoClassClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      gotoJourney();
    },
    [gotoJourney]
  );

  const onReloadClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    window.location.reload();
  }, []);

  const profilePicturesState =
    useRef<ProfilePicturesState>() as MutableRefObject<ProfilePicturesState>;
  const profilePicturesStateChanged = useRef<
    Callbacks<ProfilePicturesStateChangedEvent>
  >() as MutableRefObject<Callbacks<ProfilePicturesStateChangedEvent>>;

  const profilePicturesStateRef = useMemo<ProfilePicturesStateRef | null>(() => {
    if (resources.selected === null) {
      return null;
    }

    profilePicturesState.current = {
      pictures: resources.selected.profilePictures,
      additionalUsers: resources.selected.numTotalVotes - resources.selected.profilePictures.length,
    };
    profilePicturesStateChanged.current = new Callbacks();
    return {
      state: profilePicturesState,
      onStateChanged: profilePicturesStateChanged,
    };
  }, [resources.selected]);

  const primaryContainerStyle = useMemo<React.CSSProperties>(() => {
    if (windowSize.height <= 570) {
      return {};
    }

    return {
      paddingTop: '20px',
      paddingBottom: resources.selected === null ? '20px' : '80px',
      transition: 'padding-bottom 0.7s ease',
    };
  }, [resources.selected, windowSize]);

  const settingsStyle = useMemo<React.CSSProperties>(() => {
    const usableHeight = Math.min(844, windowSize.height);
    if (usableHeight <= 570) {
      return {
        marginBottom: '40px',
        width: '100%',
      };
    }

    const desiredWidth = Math.min(390, windowSize.width);

    const distanceFromTopOfUsable = 32;

    return {
      position: 'absolute',
      left: windowSize.width / 2 - desiredWidth / 2,
      top: windowSize.height / 2 - usableHeight / 2 + distanceFromTopOfUsable,
      width: `${desiredWidth}px`,
    };
  }, [windowSize]);

  const ctaStyle = useMemo<React.CSSProperties>(() => {
    const usableHeight = Math.min(844, windowSize.height);
    if (usableHeight <= 570) {
      return {
        marginTop: '40px',
        width: '100%',
      };
    }

    const buttonHeight = 56;
    const distanceFromBottomOfUsable = 60;

    return {
      position: 'absolute',
      top: windowSize.height / 2 + usableHeight / 2 - distanceFromBottomOfUsable - buttonHeight,
      width: `${windowSize.width}px`,
    };
  }, [windowSize]);

  if (resources.error !== null) {
    if (resources.background !== null) {
      return (
        <div className={styles.container}>
          <div className={styles.imageContainer}>
            <OsehImageFromState {...resources.background} />
          </div>
          <div className={styles.innerContainer}>
            <div className={styles.primaryContainer}>
              <ErrorBlock>{resources.error}</ErrorBlock>
              <div className={styles.ctaContainer} style={{ marginTop: '80px' }}>
                <Button type="button" variant="outlined-white" onClick={onReloadClick} fullWidth>
                  Reload
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.container}>
        <div className={styles.innerContainer}>
          <div className={styles.primaryContainer}>
            <ErrorBlock>{resources.error}</ErrorBlock>
            <div className={styles.ctaContainer} style={{ marginTop: '80px' }}>
              <Button type="button" variant="outlined-white" onClick={onReloadClick} fullWidth>
                Reload
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (
    resources.background === null ||
    resources.loading ||
    resources.options === null ||
    words === null
  ) {
    return <></>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...resources.background} />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.settingsLinkContainer} style={settingsStyle}>
          <a href="/settings" className={styles.settingsLink}>
            <div className={styles.profilePictureContainer}>
              {resources.profilePicture.state === 'available' && (
                <OsehImageFromState {...resources.profilePicture.image} />
              )}
            </div>
            <div className={styles.settingsText}>
              <div className={styles.greeting}>
                Hi {loginContext.userAttributes?.givenName ?? 'there'} 👋
              </div>
              <div className={styles.settingsLinkText}>Daily Check-in</div>
            </div>
          </a>
          <div className={styles.favoritesContainer}>
            <Button type="button" variant="link-white" onClick={onGotoFavoritesClick}>
              <div className={styles.favoritesInner}>
                <span className={styles.emptyHeart} /> Favorites
              </div>
            </Button>
          </div>
        </div>
        <div className={styles.primaryContainer} style={primaryContainerStyle}>
          <div className={styles.title}>How do you want to feel?</div>
          <Words
            options={words}
            onWordClick={onWordClick}
            pressed={pressed}
            layout={resources.selected === null ? 'horizontal' : 'vertical'}
          />
          {profilePicturesStateRef !== null && (
            <div className={styles.profilePicturesContainer}>
              <ProfilePictures
                profilePictures={profilePicturesStateRef}
                hereSettings={{ type: 'floating', action: 'voted' }}
              />
            </div>
          )}
        </div>
        {resources.selected !== null && (
          <div className={styles.ctaContainer} style={ctaStyle}>
            <Button type="button" variant="filled-white" onClick={onGotoClassClick} fullWidth>
              Take Me To Class
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

type Pos = { x: number; y: number };
type Size = { width: number; height: number };

const computeHorizontalPositions = (
  windowSize: Size,
  words: Size[]
): { positions: Pos[]; size: Size } => {
  // This is essentially a flex row with line break, aligned center,
  // with a 10px horizontal gap and 24px vertical gap, and a 24px
  // left/right margin.
  const xGap = 10;
  const yGap = 24;

  const centerX = windowSize.width / 2;
  const maxRowWidth = Math.min(390 - 48, windowSize.width - 48);

  let y = 0;
  let currentRow: Size[] = [];
  let currentRowWidth = 0;
  let widestRow = 0;
  const positions: Pos[] = [];

  function breakRow() {
    if (currentRow.length === 0) {
      throw new Error("Can't break row with no words");
    }

    if (y > 0) {
      y += yGap;
    }

    let rowHeight = currentRow[0].height;
    for (let i = 1; i < currentRow.length; i++) {
      if (currentRow[i].height > rowHeight) {
        rowHeight = currentRow[i].height;
      }
    }

    let x = centerX - currentRowWidth / 2;
    for (let i = 0; i < currentRow.length; i++) {
      positions.push({ x, y });
      x += currentRow[i].width + xGap;
    }
    y += rowHeight;
    if (x > widestRow) {
      widestRow = x;
    }
  }

  for (let i = 0; i < words.length; i++) {
    const widthRowWithWord =
      currentRow.length === 0 ? words[i].width : currentRowWidth + 10 + words[i].width;
    if (widthRowWithWord < maxRowWidth) {
      if (i === words.length - 2 && currentRow.length >= 2) {
        // avoid widowing
        const widthRowWithLastWord = widthRowWithWord + 10 + words[i + 1].width;
        if (widthRowWithLastWord >= maxRowWidth) {
          breakRow();
          currentRow = [words[i]];
          currentRowWidth = words[i].width;
          continue;
        }
      }
      currentRow.push(words[i]);
      currentRowWidth = widthRowWithWord;
      continue;
    }

    breakRow();
    currentRow = [words[i]];
    currentRowWidth = words[i].width;
  }

  if (currentRow.length > 0) {
    breakRow();
  }

  return {
    positions,
    size: { width: windowSize.width, height: y },
  };
};

const computeVerticalPositions = (
  windowSize: Size,
  words: Size[]
): { positions: Pos[]; size: Size } => {
  // two-column layout, left-aligned, with an 8px vertical gap
  // and a 80px horizontal gap. We'll reduce the horizontal gap
  // if there isn't enough space. We layout as if the second column
  // is a bit wider, which essentially shifts the whole layout left
  // by half that amount. I don't know why, but it looks more centered that
  // way
  const bonusWidthForSecondColumn = 24;
  let xGap = 80;
  const yGap = 8;

  const column1Words: Size[] = [];
  const column2Words: Size[] = [];

  for (let i = 0; i < words.length; i++) {
    if (i % 2 === 0) {
      column1Words.push(words[i]);
    } else {
      column2Words.push(words[i]);
    }
  }

  const column1Positions: Pos[] = [];
  const column2Positions: Pos[] = [];

  const column1Width = column1Words.reduce((acc, cur) => Math.max(acc, cur.width), 0);
  const column2Width =
    column2Words.reduce((acc, cur) => Math.max(acc, cur.width), 0) + bonusWidthForSecondColumn;
  let totalWidth = column1Width + xGap + column2Width;
  if (totalWidth > windowSize.width - 40) {
    xGap = windowSize.width - 40 - column1Width - column2Width;
    totalWidth = windowSize.width - 40;
  }

  let x = (windowSize.width - totalWidth) / 2;
  let y = 0;
  for (let i = 0; i < column1Words.length; i++) {
    if (i > 0) {
      y += yGap;
    }
    column1Positions.push({ x, y });
    y += column1Words[i].height;
  }
  const column1Height = y;

  x += column1Width + xGap;
  y = 0;
  for (let i = 0; i < column2Words.length; i++) {
    if (i > 0) {
      y += yGap;
    }
    column2Positions.push({ x, y });
    y += column2Words[i].height;
  }
  const column2Height = y;

  const height = Math.max(column1Height, column2Height);
  const positions: Pos[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i % 2 === 0) {
      positions.push(column1Positions[i / 2]);
    } else {
      positions.push(column2Positions[(i - 1) / 2]);
    }
  }

  return {
    positions,
    size: { width: windowSize.width, height },
  };
};

const Words = ({
  options,
  onWordClick,
  pressed,
  layout,
}: {
  options: string[];
  onWordClick: (word: string, idx: number) => void;
  pressed: { index: number; votes: number | null } | null;
  layout: 'horizontal' | 'vertical';
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerSizeTarget = useAnimatedValueWithCallbacks<Size>(
    { width: 0, height: 0 },
    () => inferAnimators({ width: 0, height: 0 }, ease, 700),
    (size) => {
      if (containerRef.current === null) {
        return;
      }
      const container = containerRef.current;
      container.style.width = `${size.width}px`;
      container.style.height = `${size.height}px`;
    }
  );

  const windowSize = useWindowSize();
  const numOptions = options.length;
  const wordSizes: WritableValueWithCallbacks<Size>[] = useMemo(() => {
    const result = [];
    for (let i = 0; i < numOptions; i++) {
      result.push(
        (() => {
          let size: Size = { width: 0, height: 0 };
          const callbacks = new Callbacks<undefined>();
          return {
            get: () => size,
            set: (s: Size) => {
              size = s;
            },
            callbacks,
          };
        })()
      );
    }
    return result;
  }, [numOptions]);
  const wordPositions: WritableValueWithCallbacks<Pos>[] = useMemo(() => {
    const result = [];
    for (let i = 0; i < numOptions; i++) {
      result.push(
        (() => {
          let pos: Pos = { x: windowSize.width / 2, y: 0 };
          const callbacks = new Callbacks<undefined>();
          return {
            get: () => pos,
            set: (p: Pos) => {
              pos = p;
            },
            callbacks,
          };
        })()
      );
    }
    return result;
  }, [numOptions, windowSize]);

  useEffect(() => {
    for (let i = 0; i < wordSizes.length; i++) {
      wordSizes[i].callbacks.add(handleSizesChanged);
    }
    handleSizesChanged();
    return () => {
      for (let i = 0; i < wordSizes.length; i++) {
        wordSizes[i].callbacks.remove(handleSizesChanged);
      }
    };

    function handleSizesChanged() {
      const sizes = wordSizes.map((s) => s.get());
      const target =
        layout === 'horizontal'
          ? computeHorizontalPositions(windowSize, sizes)
          : computeVerticalPositions(windowSize, sizes);
      for (let i = 0; i < wordPositions.length; i++) {
        wordPositions[i].set(target.positions[i]);
        wordPositions[i].callbacks.call(undefined);
      }
      const currentContainerSize = containerSizeTarget.get();
      if (
        currentContainerSize.width !== target.size.width ||
        currentContainerSize.height !== target.size.height
      ) {
        currentContainerSize.width = target.size.width;
        currentContainerSize.height = target.size.height;
        containerSizeTarget.callbacks.call(undefined);
      }
    }
  }, [windowSize, layout, wordSizes, wordPositions, containerSizeTarget, pressed]);

  return (
    <div
      className={combineClasses(
        styles.words,
        layout === 'horizontal' ? styles.horizontalWords : styles.verticalWords,
        pressed === null ? styles.wordsWithoutPressed : styles.wordsWithPressed
      )}
      ref={containerRef}>
      {options.map((word, i) => (
        <Word
          word={word}
          idx={i}
          key={word}
          onWordClick={onWordClick}
          pressed={pressed}
          variant={layout}
          size={wordSizes[i]}
          pos={wordPositions[i]}
        />
      ))}
      <Votes pressed={pressed} wordPositions={wordPositions} wordSizes={wordSizes} />
    </div>
  );
};

type WordSetting = {
  left: number;
  top: number;
  fontSize: number;
  letterSpacing: number;
  padding: [number, number, number, number];
  borderRadius: number;
  /**
   * We implement a solid color as a gradient to the same colors;
   * this allows easing the gradient in relatively easily.
   */
  backgroundGradient: {
    color1: [number, number, number, number];
    color2: [number, number, number, number];
  };
};

const WORD_SETTINGS = {
  horizontal: {
    fontSize: 16,
    letterSpacing: 0.25,
    padding: [12, 14, 12, 14] as [number, number, number, number],
    borderRadius: 24,
  },
  vertical: {
    fontSize: 14,
    letterSpacing: 0.25,
    padding: [10, 12, 10, 12] as [number, number, number, number],
    borderRadius: 24,
  },
};

const Word = ({
  word,
  idx,
  onWordClick,
  pressed,
  variant,
  size,
  pos,
}: {
  word: string;
  idx: number;
  onWordClick: (word: string, idx: number) => void;
  pressed: { index: number; votes: number | null } | null;
  variant: 'horizontal' | 'vertical';
  size: WritableValueWithCallbacks<Size>;
  pos: ValueWithCallbacks<Pos>;
}) => {
  const wordRef = useRef<HTMLButtonElement>(null);
  const target = useAnimatedValueWithCallbacks<WordSetting>(
    {
      left: pos.get().x,
      top: pos.get().y,
      backgroundGradient: {
        color1: [255, 255, 255, 0.2],
        color2: [255, 255, 255, 0.2],
      },
      ...WORD_SETTINGS[variant],
    },
    () => [
      ...inferAnimators<{ top: number; left: number }, WordSetting>(
        { top: 0, left: 0 },
        ease,
        700,
        { onTargetChange: 'replace' }
      ),
      ...inferAnimators<
        { fontSize: number; letterSpacing: number; padding: number[]; borderRadius: number },
        WordSetting
      >({ fontSize: 0, letterSpacing: 0, padding: [0, 0, 0, 0], borderRadius: 0 }, ease, 700),
      ...inferAnimators<
        { backgroundGradient: { color1: number[]; color2: number[] } },
        WordSetting
      >(
        {
          backgroundGradient: {
            color1: [0, 0, 0, 0],
            color2: [0, 0, 0, 0],
          },
        },
        ease,
        350
      ),
    ],
    (val) => {
      if (wordRef.current === null) {
        return;
      }
      const ele = wordRef.current;
      ele.style.left = `${val.left}px`;
      ele.style.top = `${val.top}px`;
      ele.style.fontSize = `${val.fontSize}px`;
      ele.style.letterSpacing = `${val.letterSpacing.toFixed(3)}`;
      ele.style.padding = `${val.padding[0]}px ${val.padding[1]}px ${val.padding[2]}px ${val.padding[3]}px`;
      ele.style.borderRadius = `${val.borderRadius}px`;
      ele.style.background = `linear-gradient(95.08deg, rgba(${val.backgroundGradient.color1.join(
        ','
      )}) 2.49%, rgba(${val.backgroundGradient.color2.join(',')}) 97.19%)`;

      const realSize = ele.getBoundingClientRect();
      const realWidth = realSize.width;
      const realHeight = realSize.height;

      const reportedSize = size.get();
      if (realWidth !== reportedSize.width || realHeight !== reportedSize.height) {
        size.set({ width: realWidth, height: realHeight });
        size.callbacks.call(undefined);
      }
    }
  );

  useEffect(() => {
    pos.callbacks.add(handlePositionChanged);
    handlePositionChanged();
    return () => {
      pos.callbacks.remove(handlePositionChanged);
    };

    function handlePositionChanged() {
      target.set({
        left: pos.get().x,
        top: pos.get().y,
        backgroundGradient:
          pressed?.index === idx
            ? {
                //'linear-gradient(95.08deg, #57b8a2 2.49%, #009999 97.19%)'
                color1: [87, 184, 162, 1],
                color2: [0, 153, 153, 1],
              }
            : {
                //'rgba(255, 255, 255, 0.2)',
                color1: [255, 255, 255, 0.2],
                color2: [255, 255, 255, 0.2],
              },
        ...WORD_SETTINGS[variant],
      });
      target.callbacks.call(undefined);
    }
  }, [pos, variant, target, pressed, idx]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onWordClick(word, idx);
    },
    [word, idx, onWordClick]
  );

  return (
    <button
      type="button"
      className={combineClasses(styles.word, pressed?.index === idx ? styles.pressed : undefined)}
      ref={wordRef}
      onClick={handleClick}>
      {word}
    </button>
  );
};

type VotesSetting = {
  left: number;
  top: number;
  opacity: number;
};

const Votes = ({
  pressed,
  wordPositions,
  wordSizes,
}: {
  pressed: { index: number; votes: number | null } | null;
  wordPositions: ValueWithCallbacks<Pos>[];
  wordSizes: ValueWithCallbacks<Size>[];
}): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const target = useAnimatedValueWithCallbacks<VotesSetting>(
    { left: 0, top: 0, opacity: 0 },
    () => [
      new TrivialAnimator('left'),
      new TrivialAnimator('top'),
      new BezierAnimator(
        ease,
        700,
        (s) => s.opacity,
        (s, v) => (s.opacity = v)
      ),
    ],
    (val) => {
      if (ref.current === null) {
        return;
      }
      const ele = ref.current;
      ele.style.left = `${val.left}px`;
      ele.style.top = `${val.top}px`;
      ele.style.opacity = `${val.opacity * 100}%`;
    }
  );

  useEffect(() => {
    if (pressed === null) {
      target.set({ left: 0, top: 0, opacity: 0 });
      target.callbacks.call(undefined);
      return;
    }

    const availablePressed = pressed;

    wordPositions[availablePressed.index].callbacks.add(handlePosOrSizeChanged);
    wordSizes[availablePressed.index].callbacks.add(handlePosOrSizeChanged);
    handlePosOrSizeChanged();
    return () => {
      wordPositions[availablePressed.index].callbacks.remove(handlePosOrSizeChanged);
      wordSizes[availablePressed.index].callbacks.remove(handlePosOrSizeChanged);
    };

    function handlePosOrSizeChanged() {
      const pos = wordPositions[availablePressed.index].get();
      const size = wordSizes[availablePressed.index].get();
      target.set({
        left: pos.x + size.width + 6,
        top: pos.y + 11,
        opacity: 1,
      });
      target.callbacks.call(undefined);
    }
  }, [pressed, wordPositions, wordSizes, target]);

  return (
    <div className={styles.votes} ref={ref}>
      {pressed !== null && pressed.votes !== null
        ? `+${pressed.votes.toLocaleString()} votes`
        : '+0 votes'}
    </div>
  );
};
