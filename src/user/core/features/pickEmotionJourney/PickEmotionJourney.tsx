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
import styles from './PickEmotionJourney.module.css';
import { OsehImageFromState } from '../../../../shared/images/OsehImageFromState';
import { useWindowSize } from '../../../../shared/hooks/useWindowSize';
import { combineClasses } from '../../../../shared/lib/combineClasses';
import { ErrorBlock } from '../../../../shared/forms/ErrorBlock';
import {
  ProfilePicturesState,
  ProfilePicturesStateChangedEvent,
  ProfilePicturesStateRef,
} from '../../../interactive_prompt/hooks/useProfilePictures';
import { Callbacks } from '../../../../shared/lib/Callbacks';
import { ProfilePictures } from '../../../interactive_prompt/components/ProfilePictures';
import { Button } from '../../../../shared/forms/Button';
import { JourneyLobbyScreen } from '../../../journey/screens/JourneyLobbyScreen';
import { Journey } from '../../../journey/screens/Journey';
import { SplashScreen } from '../../../splash/SplashScreen';
import { JourneyRouterScreenId } from '../../../journey/JourneyRouter';
import { JourneyPostScreen } from '../../../journey/screens/JourneyPostScreen';
import { JourneyShareScreen } from '../../../journey/screens/JourneyShareScreen';
import { JourneyStart } from '../../../journey/screens/JourneyStart';
import { MyProfilePicture } from '../../../../shared/components/MyProfilePicture';
import { LoginContext } from '../../../../shared/contexts/LoginContext';
import { apiFetch } from '../../../../shared/ApiConstants';
import { JourneyFeedbackScreen } from '../../../journey/screens/JourneyFeedbackScreen';

/**
 * Ensures we display at least 12 options, faking the rest if necessary.
 */
const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'dev';

/**
 * The core screen where the user selects an emotion and the backend
 * uses that to select a journey
 */
export const PickEmotionJourney = ({
  state,
  resources,
  doAnticipateState,
}: FeatureComponentProps<PickEmotionJourneyState, PickEmotionJourneyResources>): ReactElement => {
  const loginContext = useContext(LoginContext);
  const [step, setStep] = useState<{
    journeyUid: string | null;
    step: 'pick' | JourneyRouterScreenId;
  }>({ journeyUid: null, step: 'pick' });
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (resources.selected === null && step.step !== 'pick') {
      setStep({ journeyUid: null, step: 'pick' });
      return;
    }

    if (resources.selected !== null && step.step === 'pick' && resources.selected.skipsStats) {
      setStep({ journeyUid: resources.selected.journey.uid, step: 'lobby' });
      return;
    }

    if (
      resources.selected !== null &&
      step.step !== 'pick' &&
      step.journeyUid !== resources.selected.journey.uid
    ) {
      console.log('returning to pick screen because its a new journey');
      setStep({ journeyUid: null, step: 'pick' });
    }
  }, [step, resources.selected]);

  const gotoJourney = useCallback(() => {
    if (resources.selected === null) {
      console.warn('gotoJourney without a journey to goto');
      return;
    }
    apiFetch(
      '/api/1/emotions/started_related_journey',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          emotion_user_uid: resources.selected.emotionUserUid,
        }),
      },
      loginContext
    );
    setStep({ journeyUid: resources.selected.journey.uid, step: 'lobby' });
  }, [resources.selected, loginContext]);

  const onFinishJourney = useCallback(() => {
    resources.onFinishedJourney.call(undefined);
    state.onFinishedClass.call(undefined);
    setStep({ journeyUid: null, step: 'pick' });
  }, [resources.onFinishedJourney, state.onFinishedClass]);

  const setScreen = useCallback(
    (
      screen: JourneyRouterScreenId | ((screen: JourneyRouterScreenId) => JourneyRouterScreenId)
    ) => {
      if (stepRef.current.step === 'pick') {
        return;
      }

      if (typeof screen === 'function') {
        screen = screen(stepRef.current.step);
      }
      if (resources.selected === null) {
        console.warn('Cannot go to journey screen without a selected emotion.');
        return;
      }
      if (screen === 'journey') {
        const shared = resources.selected.shared;
        if (shared.audio === null) {
          console.warn('Cannot go to journey screen without audio.');
          return;
        }

        if (!shared.audio.loaded) {
          console.warn('Cannot go to journey screen without loaded audio.');
          return;
        }

        if (shared.audio.play === null) {
          console.warn('Cannot go to journey screen without audio play.');
          return;
        }

        shared.audio.play();
      }
      const newStep = { journeyUid: resources.selected.journey.uid, step: screen };
      stepRef.current = newStep;
      setStep(newStep);
    },
    [resources.selected]
  );

  if (resources.forceSplash) {
    return <SplashScreen type="wordmark" />;
  }

  if (step.step === 'pick') {
    return (
      <PickEmotion
        state={state}
        resources={resources}
        doAnticipateState={doAnticipateState}
        gotoJourney={gotoJourney}
      />
    );
  }

  if (resources.selected === null) {
    console.warn("Not at the pick step, but there's no selected emotion.");
    return <></>;
  }
  const sel = resources.selected;
  const props = {
    journey: resources.selected.journey,
    shared: resources.selected.shared,
    setScreen,
    onJourneyFinished: onFinishJourney,
    isOnboarding: state.isOnboarding,
  };

  if (step.step === 'lobby') {
    if (sel.shared.darkenedImage.loading) {
      return <SplashScreen />;
    }

    return <JourneyLobbyScreen {...props} />;
  }

  if (step.step === 'start') {
    if (
      sel.shared.blurredImage.loading ||
      sel.shared.audio === null ||
      !sel.shared.audio.loaded ||
      sel.shared.audio.play === null
    ) {
      return <SplashScreen />;
    }
    return <JourneyStart {...props} selectedEmotionAntonym={sel.word.antonym} />;
  }

  if (step.step === 'journey') {
    if (sel.shared.audio === null || !sel.shared.audio.loaded) {
      return <SplashScreen />;
    }
    return <Journey {...props} />;
  }

  if (step.step === 'feedback') {
    return <JourneyFeedbackScreen {...props} />;
  }

  if (step.step === 'post') {
    return <JourneyPostScreen {...props} classesTakenToday={state.classesTakenThisSession} />;
  }

  if (step.step === 'share') {
    if (sel.shared.blurredImage.loading || sel.shared.originalImage.loading) {
      return <SplashScreen />;
    }

    return <JourneyShareScreen {...props} />;
  }

  throw new Error(createUnknownStepMessage(step.step));
};

// This function will allow the type checker to catch any missing steps
// as they will cause step not to have the `never` type
const createUnknownStepMessage = (step: never) => {
  return `Unknown step: ${JSON.stringify(step)}`;
};

/**
 * Allows the user to pick an emotion and then go to that class
 */
const PickEmotion = ({
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
              <MyProfilePicture />
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

const computeHorizontalSizes = (words: string[]): Size[] => {
  const div = document.createElement('div');
  div.classList.add(styles.word);
  div.classList.add(styles.horizontalWord);
  div.style.zIndex = '-1000';
  div.innerText = '';
  document.body.appendChild(div);
  const sizes: Size[] = [];
  for (let i = 0; i < words.length; i++) {
    div.innerText = words[i];
    sizes.push({ width: div.offsetWidth, height: div.offsetHeight });
  }
  document.body.removeChild(div);
  return sizes;
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

const computeVerticalSizes = (words: string[]): Size[] => {
  const div = document.createElement('div');
  div.style.zIndex = '-1000';
  div.classList.add(styles.word);
  div.classList.add(styles.verticalWord);
  document.body.appendChild(div);
  const sizes: Size[] = [];
  for (let i = 0; i < words.length; i++) {
    div.innerText = words[i];
    sizes.push({ width: div.offsetWidth, height: div.offsetHeight });
  }
  document.body.removeChild(div);
  return sizes;
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
  const wordRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const wordsKey = useRef<number>(0);
  if (wordRefs.current.length !== options.length) {
    wordsKey.current++;

    const newRefs = [];
    for (let i = 0; i < wordRefs.current.length && i < options.length; i++) {
      newRefs.push(wordRefs.current[i]);
    }
    for (let i = newRefs.length; i < options.length; i++) {
      newRefs.push(null);
    }
    wordRefs.current = newRefs;
  }

  const boundRefSetters = useMemo(() => {
    return options.map((_, i) => {
      return (ref: HTMLButtonElement | null) => {
        if (wordRefs.current.length <= i) {
          return;
        }

        wordRefs.current[i] = ref;
      };
    });
  }, [options]);

  const windowSize = useWindowSize();
  const horizontalSizes = useMemo(() => computeHorizontalSizes(options), [options]);
  const verticalSizes = useMemo(() => computeVerticalSizes(options), [options]);
  const wordLayout = useMemo(() => {
    if (layout === 'horizontal') {
      return computeHorizontalPositions(windowSize, horizontalSizes);
    }
    return computeVerticalPositions(windowSize, verticalSizes);
  }, [windowSize, layout, horizontalSizes, verticalSizes]);

  const wordsStyle = useMemo(() => {
    return {
      width: `${wordLayout.size.width}px`,
      height: `${wordLayout.size.height}px`,
    };
  }, [wordLayout.size]);

  const individualWordStyles = useMemo(() => {
    const styles: { [key: string]: React.CSSProperties } = {};
    for (let i = 0; i < wordLayout.positions.length; i++) {
      styles[i.toString()] = {
        left: `${wordLayout.positions[i].x}px`,
        top: `${wordLayout.positions[i].y}px`,
      };
    }
    return styles;
  }, [wordLayout.positions]);

  const votesStyle = useMemo<React.CSSProperties>(() => {
    if (pressed === null || pressed.votes === null) {
      return { opacity: '0%', left: 0, top: 0 };
    }

    const pos = wordLayout.positions[pressed.index];
    const size =
      layout === 'horizontal' ? horizontalSizes[pressed.index] : verticalSizes[pressed.index];
    const votesHeight = 12;

    return {
      opacity: '100%',
      left: pos.x + size.width + 6,
      top: pos.y + size.height / 2 - votesHeight / 2,
    };
  }, [pressed, horizontalSizes, verticalSizes, wordLayout, layout]);

  const boundOnClicks = useMemo(() => {
    return options.map((word, i) => {
      return (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        onWordClick(word, i);
      };
    });
  }, [options, onWordClick]);

  return (
    <div
      className={combineClasses(
        styles.words,
        layout === 'horizontal' ? styles.horizontalWords : styles.verticalWords,
        pressed === null ? styles.wordsWithoutPressed : styles.wordsWithPressed
      )}
      style={wordsStyle}>
      {options.map((word, i) => (
        <button
          type="button"
          onClick={boundOnClicks[i]}
          key={i}
          ref={boundRefSetters[i]}
          className={combineClasses(
            styles.word,
            layout === 'horizontal' ? styles.horizontalWord : styles.verticalWord,
            pressed?.index === i ? styles.pressedWord : undefined
          )}
          style={individualWordStyles[i]}>
          {word}
        </button>
      ))}
      <div className={styles.votes} style={votesStyle}>
        {pressed !== null && pressed.votes !== null
          ? `+${pressed.votes.toLocaleString()} votes`
          : '+0 votes'}
      </div>
    </div>
  );
};
