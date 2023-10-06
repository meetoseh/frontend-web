import { ReactElement, useCallback, useContext, useEffect, useRef } from 'react';
import { FeatureComponentProps } from '../../models/Feature';
import { PickEmotionJourneyResources } from './PickEmotionJourneyResources';
import { PickEmotionJourneyState } from './PickEmotionJourneyState';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { useWindowSizeValueWithCallbacks } from '../../../../shared/hooks/useWindowSize';
import { ProfilePicturesState } from '../../../interactive_prompt/hooks/useProfilePictures';
import {
  ValueWithCallbacks,
  WritableValueWithCallbacks,
  useWritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';
import styles from './PickEmotion.module.css';
import { ErrorBlock } from '../../../../shared/forms/ErrorBlock';
import { Button } from '../../../../shared/forms/Button';
import {
  HereSettings,
  ProfilePictures,
} from '../../../interactive_prompt/components/ProfilePictures';
import {
  BezierAnimator,
  TrivialAnimator,
  inferAnimators,
} from '../../../../shared/anim/AnimationLoop';
import { ease } from '../../../../shared/lib/Bezier';
import { useAnimatedValueWithCallbacks } from '../../../../shared/anim/useAnimatedValueWithCallbacks';
import { useUnwrappedValueWithCallbacks } from '../../../../shared/hooks/useUnwrappedValueWithCallbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';

/**
 * Ensures we display at least 12 options, faking the rest if necessary.
 */
const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'dev';

/**
 * The settings for the profile pictures
 */
const hereSettings: HereSettings = { type: 'floating', action: 'voted' };

/**
 * Allows the user to pick an emotion and then go to that class
 */
export const PickEmotion = ({
  resources,
  gotoJourney,
}: FeatureComponentProps<PickEmotionJourneyState, PickEmotionJourneyResources> & {
  gotoJourney: () => void;
}): ReactElement => {
  const loginContext = useContext(LoginContext);
  const selectedInfoVWC = useMappedValueWithCallbacks(
    resources,
    (r) => {
      if (r.selected === null || r.options === null) {
        return null;
      }

      const sel = r.selected;

      return {
        word: sel.word.word,
        index: r.options.words.findIndex((opt) => opt.word === sel.word.word),
        numVotes: sel.numVotes,
      };
    },
    {
      outputEqualityFn: (a, b) => {
        if (a === null || b === null) {
          return a === b;
        }

        return a.word === b.word && a.numVotes === b.numVotes && a.index === b.index;
      },
    }
  );
  const wordsVWC = useMappedValueWithCallbacks(
    resources,
    (r) => {
      const res = r.options?.words?.map((opt) => opt.word) ?? [];
      if (isDevelopment) {
        while (res.length < 12) {
          res.push('faked');
        }
      }
      return res;
    },
    {
      outputEqualityFn: (a, b) => {
        return a.length === b.length && a.every((v, i) => v === b[i]);
      },
    }
  );
  const tentativelyPressedVWC = useWritableValueWithCallbacks<number | null>(() => null);
  const visuallyPressedVWC = useMappedValuesWithCallbacks(
    [selectedInfoVWC, tentativelyPressedVWC, wordsVWC],
    () => {
      const selected = selectedInfoVWC.get();
      const tentativelyPressed = tentativelyPressedVWC.get();
      const words = wordsVWC.get();

      if (selected !== null) {
        return {
          index: selected.index,
          votes: selected.numVotes,
        };
      }

      if (tentativelyPressed !== null && tentativelyPressed < words.length) {
        return {
          index: tentativelyPressed,
          votes: 0,
        };
      }

      return null;
    },
    {
      outputEqualityFn: (a, b) => {
        if (a === null || b === null) {
          return a === b;
        }

        return a.votes === b.votes && a.index === b.index;
      },
    }
  );
  const windowSizeVWC = useWindowSizeValueWithCallbacks();

  const onWordClick = useCallback(
    (word: string, index: number) => {
      const res = resources.get();
      if (res.options !== null && index < res.options.words.length) {
        const emotion = res.options.words[index];
        tentativelyPressedVWC.set(index);
        tentativelyPressedVWC.callbacks.call(undefined);
        res.onSelect.call(undefined, emotion);
      }
    },
    [tentativelyPressedVWC, resources]
  );

  const onGotoFavoritesClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources.get().gotoFavorites();
    },
    [resources]
  );

  const onGotoSettingsClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      resources.get().gotoSettings();
    },
    [resources]
  );

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

  const primaryContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedInfoVWC.callbacks.add(updatePrimaryContainerStyle);
    windowSizeVWC.callbacks.add(updatePrimaryContainerStyle);
    updatePrimaryContainerStyle();
    return () => {
      selectedInfoVWC.callbacks.remove(updatePrimaryContainerStyle);
      windowSizeVWC.callbacks.remove(updatePrimaryContainerStyle);
    };

    function updatePrimaryContainerStyle() {
      if (primaryContainerRef.current === null) {
        return;
      }
      const ele = primaryContainerRef.current;

      const selectedInfo = selectedInfoVWC.get();
      const windowSize = windowSizeVWC.get();

      if (windowSize.height <= 570) {
        ele.removeAttribute('style');
        return;
      }

      ele.style.paddingTop = '20px';
      ele.style.paddingBottom = selectedInfo === null ? '20px' : '80px';
      ele.style.transition = 'padding-bottom 0.7s ease';
      // TODO: AnimationLoop for the paddingBottom for native compat
    }
  }, [selectedInfoVWC, windowSizeVWC]);

  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let oldTechnique: 'short' | 'normal' | null = null;
    windowSizeVWC.callbacks.add(updateSettingsStyle);
    updateSettingsStyle();
    return () => {
      windowSizeVWC.callbacks.remove(updateSettingsStyle);
    };

    function updateSettingsStyle() {
      if (settingsRef.current === null) {
        return;
      }
      const ele = settingsRef.current;

      const windowSize = windowSizeVWC.get();

      const usableHeight = Math.min(844, windowSize.height);
      if (usableHeight <= 570) {
        if (oldTechnique !== 'short') {
          ele.removeAttribute('style');
          ele.style.marginBottom = '40px';
          ele.style.width = '100%';
          oldTechnique = 'short';
        }
        return;
      }

      if (oldTechnique !== 'normal') {
        ele.removeAttribute('style');
        ele.style.position = 'absolute';
        oldTechnique = 'normal';
      }

      const desiredWidth = Math.min(390, windowSize.width);
      const distanceFromTopOfUsable = 32;

      ele.style.left = `${windowSize.width / 2 - desiredWidth / 2}px`;
      ele.style.top = `${windowSize.height / 2 - usableHeight / 2 + distanceFromTopOfUsable}px`;
      ele.style.width = `${desiredWidth}px`;
    }
  }, [windowSizeVWC]);

  const ctaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let oldTechnique: 'short' | 'normal' | null = null;
    let oldHidden: boolean | null = null;
    windowSizeVWC.callbacks.add(updateCTAStyle);
    selectedInfoVWC.callbacks.add(updateCTAStyle);
    updateCTAStyle();
    return () => {
      windowSizeVWC.callbacks.remove(updateCTAStyle);
      selectedInfoVWC.callbacks.remove(updateCTAStyle);
    };

    function updateCTAStyle() {
      if (ctaRef.current === null) {
        return;
      }
      const ele = ctaRef.current;

      const windowSize = windowSizeVWC.get();
      const selectedInfo = selectedInfoVWC.get();

      if (selectedInfo === null) {
        if (oldHidden !== true) {
          ele.removeAttribute('style');
          ele.style.display = 'none';
          oldHidden = true;
        }
        oldTechnique = null;
        return;
      }

      if (oldHidden !== false) {
        ele.removeAttribute('style');
        oldHidden = false;
        oldTechnique = null;
      }

      const usableHeight = Math.min(844, windowSize.height);
      if (usableHeight <= 570) {
        if (oldTechnique !== 'short') {
          ele.removeAttribute('style');
          ele.style.marginTop = '40px';
          ele.style.width = '100%';
          oldTechnique = 'short';
        }
        return;
      }

      if (oldTechnique !== 'normal') {
        ele.removeAttribute('style');
        ele.style.position = 'absolute';
        oldTechnique = 'normal';
      }

      const buttonHeight = 56;
      const distanceFromBottomOfUsable = 60;

      ele.style.top = `${
        windowSize.height / 2 + usableHeight / 2 - distanceFromBottomOfUsable - buttonHeight
      }px`;
      ele.style.width = `${windowSize.width}px`;
    }
  }, [windowSizeVWC, selectedInfoVWC]);

  const error = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(resources, (r) => r.error)
  );
  const background = useMappedValueWithCallbacks(resources, (r) => r.background);
  const profilePicture = useUnwrappedValueWithCallbacks(
    useMappedValueWithCallbacks(resources, (r) => r.profilePicture)
  );
  const profilePicturesState = useMappedValueWithCallbacks(resources, (r): ProfilePicturesState => {
    if (r.selected === null) {
      return {
        pictures: [],
        additionalUsers: 0,
      };
    }

    return {
      pictures: r.selected.profilePictures,
      additionalUsers: r.selected.numTotalVotes - r.selected.numVotes,
    };
  });

  const layoutVWC = useMappedValueWithCallbacks(
    selectedInfoVWC,
    (si): 'horizontal' | 'vertical' => {
      return si === null ? 'horizontal' : 'vertical';
    }
  );

  if (error !== null) {
    return (
      <div className={styles.container}>
        <div className={styles.innerContainer}>
          <div className={styles.primaryContainer}>
            <ErrorBlock>{error}</ErrorBlock>
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
      <div className={styles.imageContainer}>
        <OsehImageFromStateValueWithCallbacks state={background} />
      </div>
      <div className={styles.innerContainer}>
        <div className={styles.settingsLinkContainer} ref={settingsRef}>
          <button onClick={onGotoSettingsClick} className={styles.settingsLink}>
            <div className={styles.profilePictureContainer}>
              {profilePicture.state === 'available' && (
                <OsehImageFromState {...profilePicture.image} />
              )}
            </div>
            <div className={styles.settingsText}>
              <div className={styles.greeting}>
                Hi {loginContext.userAttributes?.givenName ?? 'there'} 👋
              </div>
              <div className={styles.settingsLinkText}>Daily Check-in</div>
            </div>
          </button>
          <div className={styles.favoritesContainer}>
            <Button type="button" variant="link-white" onClick={onGotoFavoritesClick}>
              <div className={styles.favoritesInner}>
                <span className={styles.emptyHeart} /> Favorites
              </div>
            </Button>
          </div>
        </div>
        <div className={styles.primaryContainer} ref={primaryContainerRef}>
          <div className={styles.title}>How do you want to feel?</div>
          <Words
            optionsVWC={wordsVWC}
            onWordClick={onWordClick}
            pressedVWC={visuallyPressedVWC}
            layoutVWC={layoutVWC}
          />
          <div className={styles.profilePicturesContainer}>
            <ProfilePictures profilePictures={profilePicturesState} hereSettings={hereSettings} />
          </div>
        </div>
        <div className={styles.ctaContainer} ref={ctaRef}>
          <Button type="button" variant="filled-white" onClick={onGotoClassClick} fullWidth>
            Take Me To Class
          </Button>
        </div>
      </div>
    </div>
  );
};

type Pos = { x: number; y: number };
type Size = { width: number; height: number };

const computeUsingFlowLayout = (
  windowSize: Size,
  words: Size[],
  xGap: number,
  yGap: number
): { positions: Pos[]; size: Size } => {
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
      currentRow.length === 0 ? words[i].width : currentRowWidth + xGap + words[i].width;
    if (widthRowWithWord < maxRowWidth) {
      if (i === words.length - 2 && currentRow.length >= 2) {
        // avoid widowing
        const widthRowWithLastWord = widthRowWithWord + xGap + words[i + 1].width;
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

const computeHorizontalPositions = (
  windowSize: Size,
  words: Size[]
): { positions: Pos[]; size: Size } => {
  return computeUsingFlowLayout(windowSize, words, 10, 24);
};

const computeVerticalPositions = (
  windowSize: Size,
  words: Size[],
  pressed: { index: number; votes: number | null } | null
): { positions: Pos[]; size: Size } => {
  // originally this was a two-column layout, but that turned out to be
  // fairly annoying when also dealing with font sizing, so this is just
  // the horizontal layout with more spacing after the pressed index
  // (if any)

  if (pressed === null) {
    return computeHorizontalPositions(windowSize, words);
  }

  const resizedWords = words.map((word, idx) => {
    if (idx === pressed.index) {
      return {
        width: word.width + 80,
        height: word.height,
      };
    }
    return word;
  });

  return computeUsingFlowLayout(windowSize, resizedWords, 8, 20);
};

const Words = ({
  optionsVWC,
  onWordClick,
  pressedVWC,
  layoutVWC,
}: {
  optionsVWC: ValueWithCallbacks<string[]>;
  onWordClick: (word: string, idx: number) => void;
  pressedVWC: ValueWithCallbacks<{ index: number; votes: number | null } | null>;
  layoutVWC: ValueWithCallbacks<'horizontal' | 'vertical'>;
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

  const windowSizeVWC = useWindowSizeValueWithCallbacks();
  const wordSizesVWC = useWritableValueWithCallbacks<Size[]>(() =>
    optionsVWC.get().map(() => ({
      width: 0,
      height: 0,
    }))
  );

  useEffect(() => {
    optionsVWC.callbacks.add(updateWordSizes);
    updateWordSizes();
    return () => {
      optionsVWC.callbacks.remove(updateWordSizes);
    };

    function updateWordSizes() {
      if (wordSizesVWC.get().length === optionsVWC.get().length) {
        return;
      }

      const oldWordSizes = wordSizesVWC.get();

      const wordSizes = optionsVWC.get().map((_, idx) => ({
        width: oldWordSizes.length > idx ? oldWordSizes[idx].width : 0,
        height: oldWordSizes.length > idx ? oldWordSizes[idx].height : 0,
      }));
      wordSizesVWC.set(wordSizes);
      wordSizesVWC.callbacks.call(undefined);
    }
  }, [optionsVWC, wordSizesVWC]);

  const wordPositionsVWC = useWritableValueWithCallbacks<Pos[]>(() =>
    optionsVWC.get().map(() => ({
      x: windowSizeVWC.get().width / 2,
      y: 0,
    }))
  );

  useEffect(() => {
    optionsVWC.callbacks.add(updateWordPositions);
    updateWordPositions();
    return () => {
      optionsVWC.callbacks.remove(updateWordPositions);
    };

    function updateWordPositions() {
      const oldWordPositions = wordPositionsVWC.get();
      const options = optionsVWC.get();

      if (oldWordPositions.length === options.length) {
        return;
      }

      const wordPositions = options.map((_, idx) => ({
        x: oldWordPositions.length > idx ? oldWordPositions[idx].x : windowSizeVWC.get().width / 2,
        y: oldWordPositions.length > idx ? oldWordPositions[idx].y : 0,
      }));
      wordPositionsVWC.set(wordPositions);
      wordPositionsVWC.callbacks.call(undefined);
    }
  }, [optionsVWC, wordPositionsVWC, windowSizeVWC]);

  useEffect(() => {
    wordSizesVWC.callbacks.add(reposition);
    layoutVWC.callbacks.add(reposition);
    windowSizeVWC.callbacks.add(reposition);
    pressedVWC.callbacks.add(reposition);
    reposition();
    return () => {
      wordSizesVWC.callbacks.remove(reposition);
      layoutVWC.callbacks.remove(reposition);
      windowSizeVWC.callbacks.remove(reposition);
      pressedVWC.callbacks.remove(reposition);
    };

    function reposition() {
      const sizes = wordSizesVWC.get();
      const layout = layoutVWC.get();
      const windowSize = windowSizeVWC.get();
      const pressed = pressedVWC.get();
      const target =
        layout === 'horizontal'
          ? computeHorizontalPositions(windowSize, sizes)
          : computeVerticalPositions(windowSize, sizes, pressed);

      wordPositionsVWC.set(target.positions);
      wordPositionsVWC.callbacks.call(undefined);

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
  }, [layoutVWC, windowSizeVWC, wordSizesVWC, wordPositionsVWC, containerSizeTarget, pressedVWC]);

  return (
    <div className={styles.words} ref={containerRef}>
      <RenderGuardedComponent
        props={optionsVWC}
        component={(options) => {
          return (
            <>
              {options.map((word, i) => (
                <WordAdapter
                  word={word}
                  idx={i}
                  key={`${word}-${i}`}
                  onWordClick={onWordClick}
                  pressedVWC={pressedVWC}
                  variantVWC={layoutVWC}
                  wordSizesVWC={wordSizesVWC}
                  wordPositionsVWC={wordPositionsVWC}
                />
              ))}
            </>
          );
        }}
      />
      <Votes
        pressedVWC={pressedVWC}
        wordPositionsVWC={wordPositionsVWC}
        wordSizesVWC={wordSizesVWC}
      />
    </div>
  );
};

type WordSetting = {
  left: number;
  top: number;
  /**
   * A scale where 1 = 100% (normal size), 1.1 = 110% (10% larger), etc
   */
  scale: number;
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
    scale: 1,
  },
  vertical: {
    scale: 0.875,
  },
};

const WordAdapter = ({
  word,
  idx,
  onWordClick,
  pressedVWC,
  variantVWC,
  wordSizesVWC,
  wordPositionsVWC,
}: {
  word: string;
  idx: number;
  onWordClick: (word: string, idx: number) => void;
  pressedVWC: ValueWithCallbacks<{
    index: number;
    votes: number | null;
  } | null>;
  variantVWC: ValueWithCallbacks<'horizontal' | 'vertical'>;
  wordSizesVWC: WritableValueWithCallbacks<Size[]>;
  wordPositionsVWC: ValueWithCallbacks<Pos[]>;
}): ReactElement => {
  const size = useWritableValueWithCallbacks<Size>(
    () => wordSizesVWC.get()[idx] ?? { width: 0, height: 0 }
  );
  const position = useWritableValueWithCallbacks<Pos>(
    () => wordPositionsVWC.get()[idx] ?? { x: 0, y: 0 }
  );

  useEffect(() => {
    size.callbacks.add(updateParentSize);
    variantVWC.callbacks.add(updateParentSize);
    updateParentSize();
    return () => {
      size.callbacks.remove(updateParentSize);
      variantVWC.callbacks.remove(updateParentSize);
    };

    function updateParentSize() {
      const currentParent = wordSizesVWC.get();
      const variant = variantVWC.get();
      if (idx >= currentParent.length) {
        return;
      }

      const correctUnscaledSize = size.get();
      const correctSize = {
        width: correctUnscaledSize.width * WORD_SETTINGS[variant].scale,
        height: correctUnscaledSize.height * WORD_SETTINGS[variant].scale,
      };

      const currentSize = currentParent[idx];
      if (currentSize.width === correctSize.width && currentSize.height === correctSize.height) {
        return;
      }

      currentParent[idx] = {
        width: correctSize.width,
        height: correctSize.height,
      };
      wordSizesVWC.callbacks.call(undefined);
    }
  }, [idx, size, wordSizesVWC, variantVWC]);

  useEffect(() => {
    wordPositionsVWC.callbacks.add(updateChildPosition);
    updateChildPosition();
    return () => {
      wordPositionsVWC.callbacks.remove(updateChildPosition);
    };

    function updateChildPosition() {
      const currentParent = wordPositionsVWC.get();
      if (idx >= currentParent.length) {
        return;
      }

      const correctPosition = currentParent[idx];
      const currentPosition = position.get();

      if (correctPosition.x === currentPosition.x && correctPosition.y === currentPosition.y) {
        return;
      }

      position.set({ x: correctPosition.x, y: correctPosition.y });
      position.callbacks.call(undefined);
    }
  });

  return (
    <Word
      word={word}
      idx={idx}
      onWordClick={onWordClick}
      pressedVWC={pressedVWC}
      variantVWC={variantVWC}
      sizeVWC={size}
      posVWC={position}
    />
  );
};

const Word = ({
  word,
  idx,
  onWordClick,
  pressedVWC,
  variantVWC,
  sizeVWC,
  posVWC,
}: {
  word: string;
  idx: number;
  onWordClick: (word: string, idx: number) => void;
  pressedVWC: ValueWithCallbacks<{ index: number; votes: number | null } | null>;
  variantVWC: ValueWithCallbacks<'horizontal' | 'vertical'>;
  sizeVWC: WritableValueWithCallbacks<Size>;
  posVWC: ValueWithCallbacks<Pos>;
}) => {
  const wordRef = useRef<HTMLButtonElement>(null);
  const target = useAnimatedValueWithCallbacks<WordSetting>(
    {
      left: posVWC.get().x,
      top: posVWC.get().y,
      backgroundGradient: {
        color1: [255, 255, 255, 0.2],
        color2: [255, 255, 255, 0.2],
      },
      ...WORD_SETTINGS[variantVWC.get()],
    },
    () => [
      ...inferAnimators<{ top: number; left: number }, WordSetting>(
        { top: 0, left: 0 },
        ease,
        700,
        { onTargetChange: 'replace' }
      ),
      ...inferAnimators<{ scale: number }, WordSetting>({ scale: 0 }, ease, 700),
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
      // scale but keep left edge and top y in place
      ele.style.transform = `translate(${50 * (val.scale - 1)}%, ${50 * (val.scale - 1)}%) scale(${
        val.scale
      })`;
      ele.style.background = `linear-gradient(95.08deg, rgba(${val.backgroundGradient.color1.join(
        ','
      )}) 2.49%, rgba(${val.backgroundGradient.color2.join(',')}) 97.19%)`;

      const realSize = ele.getBoundingClientRect();
      const realWidth = realSize.width;
      const realHeight = realSize.height;
      const unscaledSize = {
        width: realWidth / val.scale,
        height: realHeight / val.scale,
      };

      const reportedSize = sizeVWC.get();
      if (
        unscaledSize.width !== reportedSize.width ||
        unscaledSize.height !== reportedSize.height
      ) {
        sizeVWC.set(unscaledSize);
        sizeVWC.callbacks.call(undefined);
      }
    }
  );

  useEffect(() => {
    posVWC.callbacks.add(render);
    variantVWC.callbacks.add(render);
    pressedVWC.callbacks.add(render);
    let waitingForNonZeroSizeCanceler = waitForNonZeroSize();
    render();
    return () => {
      waitingForNonZeroSizeCanceler();
      posVWC.callbacks.remove(render);
      variantVWC.callbacks.remove(render);
      pressedVWC.callbacks.remove(render);
    };

    function render() {
      target.set({
        left: posVWC.get().x,
        top: posVWC.get().y,
        backgroundGradient:
          pressedVWC.get()?.index === idx
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
        ...WORD_SETTINGS[variantVWC.get()],
      });
      target.callbacks.call(undefined);
    }

    function waitForNonZeroSize(): () => void {
      if (wordRef.current === null) {
        return () => {};
      }
      const ele = wordRef.current;
      let running = true;
      const interval = setInterval(checkSize, 100);
      const unmount = () => {
        if (running) {
          running = false;
          clearInterval(interval);
        }
      };
      checkSize();
      return unmount;

      function checkSize() {
        if (!running) {
          return;
        }
        render();

        const realSize = ele.getBoundingClientRect();
        const realWidth = realSize.width;
        const realHeight = realSize.height;

        if (realWidth !== 0 || realHeight !== 0) {
          unmount();
          sizeVWC.set({ width: realWidth, height: realHeight });
          sizeVWC.callbacks.call(undefined);
        }
      }
    }
  }, [posVWC, variantVWC, target, pressedVWC, idx, sizeVWC]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      onWordClick(word, idx);
    },
    [word, idx, onWordClick]
  );

  return (
    <button type="button" className={styles.word} ref={wordRef} onClick={handleClick}>
      {word}
    </button>
  );
};

type VotesSetting = {
  left: number;
  top: number;
  opacity: number;
  textContent: string;
};

const Votes = ({
  pressedVWC,
  wordPositionsVWC,
  wordSizesVWC,
}: {
  pressedVWC: ValueWithCallbacks<{ index: number; votes: number | null } | null>;
  wordPositionsVWC: ValueWithCallbacks<Pos[]>;
  wordSizesVWC: ValueWithCallbacks<Size[]>;
}): ReactElement => {
  const ref = useRef<HTMLDivElement>(null);
  const target = useAnimatedValueWithCallbacks<VotesSetting>(
    { left: 0, top: 0, opacity: 0, textContent: '+0 votes' },
    () => [
      new TrivialAnimator('left'),
      new TrivialAnimator('top'),
      new BezierAnimator(
        ease,
        700,
        (s) => s.opacity,
        (s, v) => (s.opacity = v)
      ),
      new TrivialAnimator('textContent'),
    ],
    (val) => {
      if (ref.current === null) {
        return;
      }
      const ele = ref.current;
      ele.style.left = `${val.left}px`;
      ele.style.top = `${val.top}px`;
      ele.style.opacity = `${val.opacity * 100}%`;
      ele.textContent = val.textContent;
    }
  );

  useEffect(() => {
    wordPositionsVWC.callbacks.add(render);
    wordSizesVWC.callbacks.add(render);
    pressedVWC.callbacks.add(render);
    render();
    return () => {
      wordPositionsVWC.callbacks.remove(render);
      wordSizesVWC.callbacks.remove(render);
      pressedVWC.callbacks.remove(render);
    };

    function render() {
      const wordPositions = wordPositionsVWC.get();
      const wordSizes = wordSizesVWC.get();
      const pressed = pressedVWC.get();

      if (
        pressed === null ||
        pressed.index >= wordPositions.length ||
        pressed.index >= wordSizes.length
      ) {
        target.set({
          left: 0,
          top: 0,
          opacity: 0,
          textContent: '+0 votes',
        });
        target.callbacks.call(undefined);
        return;
      }

      const pos = wordPositions[pressed.index];
      const size = wordSizes[pressed.index];

      target.set({
        left: pos.x + size.width + 6,
        top: pos.y + 11,
        opacity: 1,
        textContent:
          pressed.votes !== null ? `+${pressed.votes.toLocaleString()} votes` : '+0 votes',
      });
      target.callbacks.call(undefined);
    }
  }, [wordPositionsVWC, wordSizesVWC, pressedVWC, target]);

  return <div className={styles.votes} ref={ref} />;
};
