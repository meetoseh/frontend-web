import { ReactElement, useCallback, useMemo } from 'react';
import { IconButton } from '../../../shared/forms/IconButton';
import { MinimalJourney } from '../lib/MinimalJourney';
import styles from './HistoryItem.module.css';
import { ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { useFavoritedModal } from '../hooks/useFavoritedModal';
import { useUnfavoritedModal } from '../hooks/useUnfavoritedModal';
import { textOverflowEllipses } from '../../../shared/lib/calculateKerningLength';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { InlineOsehSpinner } from '../../../shared/components/InlineOsehSpinner';
import { useReactManagedValueAsValueWithCallbacks } from '../../../shared/hooks/useReactManagedValueAsValueWithCallbacks';
import { useToggleFavorited } from '../../journey/hooks/useToggleFavorited';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';

type HistoryItemProps = {
  /**
   * The item to render
   */
  item: MinimalJourney;

  /**
   * If the user modifies the item, i.e., by favoriting/unfavoriting it,
   * the callback to update the item. This is called after the change is
   * already stored serverside.
   *
   * @param item The new item
   */
  setItem: (item: MinimalJourney) => void;

  /**
   * If true, a separator indicating the date the item was taken is rendered
   * just before the item.
   */
  separator?: boolean;

  /**
   * Called if the user clicks the item outside of the normally clickable
   * areas.
   */
  onClick?: () => void;

  /**
   * The request handler to use for instructor images
   */
  instructorImages: OsehImageStateRequestHandler;
};

/**
 * Renders a minimal journey for the favorites or history tab.
 */
export const HistoryItem = ({
  item,
  setItem,
  separator,
  onClick,
  instructorImages,
}: HistoryItemProps) => {
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const likingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const showLikedUntilVWC = useWritableValueWithCallbacks<number | undefined>(() => undefined);
  const showUnlikedUntilVWC = useWritableValueWithCallbacks<number | undefined>(() => undefined);
  const instructorImageVWC = useOsehImageStateValueWithCallbacks(
    {
      type: 'react-rerender',
      props: {
        ...item.instructor.image,
        displayWidth: 14,
        displayHeight: 14,
        alt: 'profile',
      },
    },
    instructorImages
  );
  const itemVWC = useReactManagedValueAsValueWithCallbacks(item);
  const toggleFavorited = useToggleFavorited({
    journey: item,
    shared: useMappedValueWithCallbacks(itemVWC, (item) => ({
      favorited: item.likedAt !== null,
      setFavorited: (favorited: boolean) => {
        setItem({
          ...item,
          likedAt: favorited ? new Date() : null,
        });
      },
    })),
    knownUnfavoritable: {
      type: 'react-rerender',
      props: item.lastTakenAt === null,
    },
    working: likingVWC,
  });
  const onToggleFavorited = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorited();
    },
    [toggleFavorited]
  );

  useFavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showLikedUntilVWC));
  useUnfavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showUnlikedUntilVWC));

  const ellipsedTitle = useMemo(() => textOverflowEllipses(item.title, 15), [item.title]);

  return (
    <div onClick={onClick}>
      {separator && item.lastTakenAt !== null && (
        <div className={styles.separator}>{item.lastTakenAt.toLocaleDateString()}</div>
      )}
      <div className={styles.container}>
        <div className={styles.titleAndInstructor}>
          <div className={styles.title}>{ellipsedTitle}</div>
          <div className={styles.instructor}>
            <div className={styles.instructorPictureContainer}>
              <OsehImageFromStateValueWithCallbacks state={instructorImageVWC} />
            </div>
            <div className={styles.instructorName}>{item.instructor.name}</div>
          </div>
        </div>
        <div className={styles.favoritedContainer}>
          <RenderGuardedComponent
            props={likingVWC}
            component={(liking) =>
              liking ? (
                <InlineOsehSpinner
                  size={{ type: 'react-rerender', props: { height: 24 } }}
                  variant="white"
                />
              ) : (
                <IconButton
                  icon={item.likedAt === null ? styles.unfavoritedIcon : styles.favoritedIcon}
                  srOnlyName={item.likedAt === null ? 'Like' : 'Unlike'}
                  onClick={onToggleFavorited}
                  disabled={liking}
                />
              )
            }
          />
        </div>
        <RenderGuardedComponent
          props={errorVWC}
          component={(error) => <>{error && <ErrorBlock>{error}</ErrorBlock>}</>}
        />
      </div>
    </div>
  );
};
