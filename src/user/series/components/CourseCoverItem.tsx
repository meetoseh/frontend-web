import { ReactElement, useEffect } from 'react';
import { OsehImageStateRequestHandler } from '../../../shared/images/useOsehImageStateRequestHandler';
import { ValueWithCallbacks, useWritableValueWithCallbacks } from '../../../shared/lib/Callbacks';
import { ExternalCourse } from '../lib/ExternalCourse';
import styles from './CourseCoverItem.module.css';
import { OsehImageProps, OsehImagePropsLoadable } from '../../../shared/images/OsehImageProps';
import { useWindowSizeValueWithCallbacks } from '../../../shared/hooks/useWindowSize';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import { useOsehImageStateValueWithCallbacks } from '../../../shared/images/useOsehImageStateValueWithCallbacks';
import { OsehImageFromStateValueWithCallbacks } from '../../../shared/images/OsehImageFromStateValueWithCallbacks';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { areOsehImageStatesEqual } from '../../../shared/images/OsehImageState';
import { OsehImageFromState } from '../../../shared/images/OsehImageFromState';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { largestPhysicalPerLogical } from '../../../shared/images/DisplayRatioHelper';
import { AspectRatioComparer } from '../../../shared/images/LogicalSize';
import { createValueWithCallbacksEffect } from '../../../shared/hooks/createValueWithCallbacksEffect';
import { setVWC } from '../../../shared/lib/setVWC';

export type CourseCoverItemProps = {
  /**
   * The item to render
   */
  item: ValueWithCallbacks<ExternalCourse>;

  /**
   * If the user modifies the item, i.e., by favoriting/unfavoriting it,
   * the callback to update the item. This is called after the change is
   * already stored serverside.
   *
   * @param item The new item
   */
  setItem: (item: ExternalCourse) => void;

  /**
   * A function which can be used to map all items to a new item. Used for
   * when the user performs an action that will impact items besides this
   * one
   *
   * @param fn The function to apply to each item
   */
  mapItems: (fn: (item: ExternalCourse) => ExternalCourse) => void;

  /**
   * The handler for images; allows reusing the same image state across
   * multiple components.
   */
  imageHandler: OsehImageStateRequestHandler;

  /**
   * Called if the user clicks the item outside of the normally clickable
   * areas.
   */
  onClick?: () => void;

  /** If specified, overrides the normal size calculation for the image */
  size?: ValueWithCallbacks<{ width: number; height: number }>;
};

const compareAspectRatio: AspectRatioComparer = (a, b) => a.height / a.width - b.height / b.width;
/**
 * Renders the given external course in the cover card representation, which
 * is the logo and instructor overlayed on the background at a fixed size.
 */
export const CourseCoverItem = ({
  item,
  setItem,
  mapItems,
  imageHandler,
  onClick,
  size: sizeRaw,
}: CourseCoverItemProps): ReactElement => {
  const windowSizeVWC = useWindowSizeValueWithCallbacks(
    sizeRaw === undefined ? undefined : { type: 'react-rerender', props: { width: 0, height: 0 } }
  );

  const sizeVWC = useWritableValueWithCallbacks<{ width: number; height: number }>(() => ({
    width: 0,
    height: 0,
  }));

  useEffect(() => {
    if (sizeRaw === undefined) {
      return createValueWithCallbacksEffect(windowSizeVWC, (size) => {
        const width = Math.min(342, size.width - 24);
        setVWC(
          sizeVWC,
          {
            width,
            height:
              Math.floor(width * (427 / 342) * largestPhysicalPerLogical) /
              largestPhysicalPerLogical,
          },
          (a, b) => a.width === b.width && a.height === b.height
        );
        return undefined;
      });
    }

    return createValueWithCallbacksEffect(sizeRaw, (size) => {
      setVWC(sizeVWC, size, (a, b) => a.width === b.width && a.height === b.height);
      return undefined;
    });
  }, [sizeRaw, windowSizeVWC, sizeVWC]);

  const backgroundProps = useMappedValuesWithCallbacks(
    [item, sizeVWC],
    (): OsehImagePropsLoadable => {
      const itm = item.get();
      const size = sizeVWC.get();

      return {
        uid: itm.backgroundImage.uid,
        jwt: itm.backgroundImage.jwt,
        displayWidth: size.width,
        displayHeight: size.height,
        alt: '',
      };
    }
  );
  const backgroundState = useOsehImageStateValueWithCallbacks(
    { type: 'callbacks', props: backgroundProps.get, callbacks: backgroundProps.callbacks },
    imageHandler
  );

  const logoProps = useMappedValuesWithCallbacks([backgroundProps, item], (): OsehImageProps => {
    const itm = item.get();
    const bknd = backgroundProps.get();

    if (bknd.displayWidth === null || itm.logo === null) {
      return {
        uid: null,
        jwt: null,
        displayWidth: 10,
        displayHeight: 10,
        alt: '',
      };
    }

    const width = bknd.displayWidth - 32;
    return {
      uid: itm.logo.uid,
      jwt: itm.logo.jwt,
      displayWidth: width,
      displayHeight: null,
      compareAspectRatio,
      alt: itm.title,
    };
  });
  const logoState = useOsehImageStateValueWithCallbacks(
    { type: 'callbacks', props: logoProps.get, callbacks: logoProps.callbacks },
    imageHandler
  );

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.container}
        onClick={(e) => {
          e.preventDefault();
          onClick?.();
        }}>
        <div className={styles.buttonInner}>
          <div className={styles.background}>
            <OsehImageFromStateValueWithCallbacks state={backgroundState} />
          </div>
          <div className={styles.content}>
            <div className={styles.contentInner}>
              <RenderGuardedComponent
                props={useMappedValuesWithCallbacks(
                  [logoState, item],
                  () => ({ state: logoState.get(), title: item.get().title }),
                  {
                    outputEqualityFn: (a, b) =>
                      areOsehImageStatesEqual(a.state, b.state) && a.title === b.title,
                  }
                )}
                component={({ state, title }) =>
                  state.loading ? (
                    <div className={styles.logoFallback}>{title}</div>
                  ) : (
                    <div className={styles.logo}>
                      <OsehImageFromState {...state} />
                    </div>
                  )
                }
              />
              <RenderGuardedComponent
                props={useMappedValueWithCallbacks(item, (v) => v.instructor.name)}
                component={(name) => <div className={styles.instructor}>{name}</div>}
              />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};
