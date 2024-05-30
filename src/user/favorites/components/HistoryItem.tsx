import { ReactElement, useCallback, useEffect } from 'react';
import { IconButton } from '../../../shared/forms/IconButton';
import { MinimalJourney } from '../lib/MinimalJourney';
import styles from './HistoryItem.module.css';
import { ErrorBlock } from '../../../shared/forms/ErrorBlock';
import { useFavoritedModal } from '../hooks/useFavoritedModal';
import { useUnfavoritedModal } from '../hooks/useUnfavoritedModal';
import { textOverflowEllipses } from '../../../shared/lib/calculateKerningLength';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { adaptValueWithCallbacksAsVariableStrategyProps } from '../../../shared/lib/adaptValueWithCallbacksAsVariableStrategyProps';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { InlineOsehSpinner } from '../../../shared/components/InlineOsehSpinner';
import { useToggleFavorited } from '../../journey/hooks/useToggleFavorited';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { VerticalSpacer } from '../../../shared/components/VerticalSpacer';
import { setVWC } from '../../../shared/lib/setVWC';
import { createValueWithCallbacksEffect } from '../../../shared/hooks/createValueWithCallbacksEffect';

type HistoryItemProps = {
  /**
   * The item to render
   */
  item: ValueWithCallbacks<MinimalJourney>;

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
  separator: ValueWithCallbacks<boolean>;

  /**
   * Called if the user clicks the item outside of the normally clickable
   * areas.
   */
  onClick?: () => void;

  /**
   * The request handler to use for instructor images
   */
  instructorImages: OsehImageStateRequestHandler;

  /** If specified, called if we change the favorited state of the item */
  toggledFavorited?: () => void;

  /** The amount to pad the bottom of this item with empty space, 0 not to. Intended for the last item in the list */
  padBottom?: ValueWithCallbacks<number>;
};

/**
 * Renders a minimal journey for the favorites or history tab.
 */
export const HistoryItem = ({
  item: itemVWC,
  setItem,
  separator: separatorVWC,
  onClick,
  instructorImages,
  toggledFavorited: onToggledFavoritedCallback,
  padBottom: padBottomVWC,
}: HistoryItemProps) => {
  const errorVWC = useWritableValueWithCallbacks<ReactElement | null>(() => null);
  const likingVWC = useWritableValueWithCallbacks<boolean>(() => false);
  const showLikedUntilVWC = useWritableValueWithCallbacks<number | undefined>(() => undefined);
  const showUnlikedUntilVWC = useWritableValueWithCallbacks<number | undefined>(() => undefined);
  const instructorImageVWC = useOsehImageStateValueWithCallbacks(
    adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(
        itemVWC,
        (item) => ({
          ...item.instructor.image,
          displayWidth: 14,
          displayHeight: 14,
          alt: 'profile',
        }),
        {
          outputEqualityFn: (a, b) => a.uid === b.uid && a.jwt === b.jwt,
        }
      )
    ),
    instructorImages
  );
  const toggleFavorited = useToggleFavorited({
    journey: adaptValueWithCallbacksAsVariableStrategyProps(itemVWC),
    shared: useMappedValueWithCallbacks(itemVWC, (item) => ({
      favorited: item.likedAt !== null,
      setFavorited: (favorited: boolean) => {
        setItem({
          ...item,
          likedAt: favorited ? new Date() : null,
        });
      },
    })),
    knownUnfavoritable: adaptValueWithCallbacksAsVariableStrategyProps(
      useMappedValueWithCallbacks(itemVWC, (item) => item.lastTakenAt === null)
    ),
    working: likingVWC,
  });
  const onToggleFavorited = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorited();
      onToggledFavoritedCallback?.();
    },
    [toggleFavorited, onToggledFavoritedCallback]
  );

  useFavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showLikedUntilVWC));
  useUnfavoritedModal(adaptValueWithCallbacksAsVariableStrategyProps(showUnlikedUntilVWC));

  const ellipsedTitle = useMappedValueWithCallbacks(itemVWC, (item) =>
    textOverflowEllipses(item.title, 15)
  );
  const instructorName = useMappedValueWithCallbacks(itemVWC, (item) => item.instructor.name);
  const favorited = useMappedValueWithCallbacks(itemVWC, (item) => item.likedAt !== null);

  const padBottomAlwaysAvailableVWC = useWritableValueWithCallbacks<number>(() => 0);
  useEffect(() => {
    if (padBottomVWC === undefined) {
      setVWC(padBottomAlwaysAvailableVWC, 0);
      return undefined;
    }

    return createValueWithCallbacksEffect(padBottomVWC, (padBottom) => {
      setVWC(padBottomAlwaysAvailableVWC, padBottom);
      return undefined;
    });
  }, [padBottomVWC, padBottomAlwaysAvailableVWC]);

  return (
    <div onClick={onClick}>
      <RenderGuardedComponent
        props={separatorVWC}
        component={(separator) => {
          if (!separator) {
            return <></>;
          }

          return (
            <RenderGuardedComponent
              props={itemVWC}
              component={(item) => {
                if (item.lastTakenAt === null) {
                  return <></>;
                }

                return (
                  <div className={styles.separator}>{item.lastTakenAt.toLocaleDateString()}</div>
                );
              }}
            />
          );
        }}
      />
      <div className={styles.container}>
        <div className={styles.titleAndInstructor}>
          <div className={styles.title}>
            <RenderGuardedComponent props={ellipsedTitle} component={(t) => <>{t}</>} />
          </div>
          <div className={styles.instructor}>
            <div className={styles.instructorPictureContainer}>
              <OsehImageFromStateValueWithCallbacks state={instructorImageVWC} />
            </div>
            <div className={styles.instructorName}>
              <RenderGuardedComponent props={instructorName} component={(n) => <>{n}</>} />
            </div>
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
                <RenderGuardedComponent
                  props={favorited}
                  component={(favorited) => (
                    <IconButton
                      icon={favorited ? styles.favoritedIcon : styles.unfavoritedIcon}
                      srOnlyName={favorited ? 'Unlike' : 'Like'}
                      onClick={onToggleFavorited}
                      disabled={liking}
                    />
                  )}
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
      <RenderGuardedComponent
        props={padBottomAlwaysAvailableVWC}
        component={(height) => (height === 0 ? <></> : <VerticalSpacer height={height} />)}
      />
    </div>
  );
};
