import {
  CSSProperties,
  MutableRefObject,
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useWindowSize } from '../../../shared/hooks/useWindowSize';
import { OsehImageFromState, OsehImageProps, useOsehImageState } from '../../../shared/OsehImage';
import styles from './AgendaScreen.module.css';
import { Button } from '../../../shared/forms/Button';

type AgendaScreenProps = {
  /**
   * The title for the screen, typically "What's on the agenda?"
   */
  title?: ReactElement | string;
  /**
   * The agenda items, by default
   * - Learn more about Oseh
   * - Create an account
   * - Try your first class
   * - Build a daily mindfulness habit
   */
  agenda?: (ReactElement | string)[];
  /**
   * The handler for when the continue button is clicked, or a string to have
   * the button be an anchor tag going to the specified url.
   */
  onContinue: React.MouseEventHandler<HTMLButtonElement> | string;
};

type AgendaFadeState = {
  /**
   * The performance.now() time in milliseconds (with an arbitrary starting point)
   * when we began fading in the agenda item checkmarks. This is chosen carefully
   * to allow the useEffect to be cancellable/resumable with minimum impact.
   */
  startedAt: number;
};

/**
 * Shows a preview of the apps core functionality.
 */
export const AgendaScreen = ({
  title: titleRaw,
  agenda: agendaRaw,
  onContinue,
}: AgendaScreenProps) => {
  const title = titleRaw ?? <>What&rsquo;s on the agenda?</>;
  const agenda = useMemo(
    () =>
      agendaRaw ?? [
        <>Learn more about Oseh</>,
        <>Create an account</>,
        <>Try your first class</>,
        <>Build a daily mindfulness habit</>,
      ],
    [agendaRaw]
  );

  const windowSize = useWindowSize();
  const backgroundProps = useMemo<OsehImageProps>(
    () => ({
      uid: 'oseh_if_hH68hcmVBYHanoivLMgstg',
      jwt: null,
      displayWidth: windowSize.width,
      displayHeight: windowSize.height,
      alt: '',
      isPublic: true,
      placeholderColor: '#021a1e',
    }),
    [windowSize]
  );
  const background = useOsehImageState(backgroundProps);

  const [agendaStyles, setAgendaStyles] = useState<CSSProperties[]>([]);
  const agendaFadeState = useRef<AgendaFadeState>() as MutableRefObject<AgendaFadeState>;
  if (agendaFadeState.current === undefined) {
    agendaFadeState.current = {
      startedAt: performance.now(),
    };
  }

  useEffect(() => {
    const firstItemDelayMS = 0;
    const consecutiveItemDelayMS = 250;
    let timeout: NodeJS.Timeout | undefined = undefined;

    const updateAgendaStylesAndMaybeBounce = () => {
      timeout = undefined;

      const now = performance.now();
      const timeSinceStart = now - agendaFadeState.current.startedAt;
      if (timeSinceStart < firstItemDelayMS) {
        setAgendaStyles(agenda.map(() => ({ opacity: 0 })));
        timeout = setTimeout(updateAgendaStylesAndMaybeBounce, firstItemDelayMS - timeSinceStart);
        return;
      }

      const timeSinceFirst = timeSinceStart - firstItemDelayMS;
      const lastStartedItemIndex = Math.floor(timeSinceFirst / consecutiveItemDelayMS);
      setAgendaStyles(agenda.map((_, i) => ({ opacity: i <= lastStartedItemIndex ? 1 : 0 })));

      if (lastStartedItemIndex >= agenda.length) {
        return;
      }
      const timeUntilNext = consecutiveItemDelayMS - (timeSinceFirst % consecutiveItemDelayMS);
      timeout = setTimeout(updateAgendaStylesAndMaybeBounce, timeUntilNext);
    };

    updateAgendaStylesAndMaybeBounce();
    return () => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    };
  }, [agenda]);

  return (
    <div className={styles.container}>
      <div className={styles.imageContainer}>
        <OsehImageFromState {...background} />
      </div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.agenda}>
          {agenda.map((item, i) => (
            <div key={i} className={styles.agendaItem}>
              <div className={styles.agendaCheck} style={agendaStyles[i]} />
              <div className={styles.agendaContent}>{item}</div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.buttonContainer}>
        <Button type="button" variant="filled-white" onClick={onContinue} fullWidth>
          Continue
        </Button>
      </div>
    </div>
  );
};
