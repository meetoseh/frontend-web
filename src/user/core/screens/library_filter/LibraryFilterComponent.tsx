import { ReactElement, useMemo } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import styles from './LibraryFilterComponent.module.css';
import { Button } from '../../../../shared/forms/Button';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { WipeTransitionOverlay } from '../../../../shared/components/WipeTransitionOverlay';
import {
  Callbacks,
  useWritableValueWithCallbacks,
  WritableValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { LibraryFilterResources } from './LibraryFilterResources';
import { LibraryFilterMappedParams } from './LibraryFilterParams';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import {
  SurveyCheckboxGroup,
  SurveyCheckboxGroupProps,
} from '../../../../shared/components/SurveyCheckboxGroup';
import {
  convertLibraryFilterToAPI,
  LibraryFilter,
  LibraryFilterAPI,
} from '../library/lib/LibraryFilter';
import { ContentContainer } from '../../../../shared/components/ContentContainer';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { InlineOsehSpinner } from '../../../../shared/components/InlineOsehSpinner';
import { SearchPublicInstructor } from '../library/lib/SearchPublicInstructor';
import { setVWC } from '../../../../shared/lib/setVWC';

type TakenRadioValue = 'taken' | 'not-taken';

/**
 * Allows the user to edit library filters and then, typically, return to the library
 * screen.
 */
export const LibraryFilterComponent = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<
  'library_filter',
  LibraryFilterResources,
  LibraryFilterMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);
  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (w) => w.width);

  const favoritesVWC = useWritableValueWithCallbacks<'favorites'[]>(() =>
    screen.parameters.filter.favorites === 'only' ? ['favorites'] : []
  ) as SurveyCheckboxGroupProps<'favorites'>['checked'];

  const takenVWC = useWritableValueWithCallbacks<TakenRadioValue[]>(() =>
    screen.parameters.filter.taken === 'only'
      ? ['taken']
      : screen.parameters.filter.taken === 'exclude'
      ? ['not-taken']
      : []
  ) as SurveyCheckboxGroupProps<TakenRadioValue>['checked'];

  const instructorUIDSVWC = useWritableValueWithCallbacks<Set<string>>(
    () => new Set(screen.parameters.filter.instructors)
  );

  const getCurrentFilter = () => {
    const result: LibraryFilter = {
      ...screen.parameters.filter,
      favorites: favoritesVWC.get().length > 0 ? 'only' : 'ignore',
      taken:
        takenVWC.get().length === 1
          ? takenVWC.get()[0] === 'taken'
            ? 'only'
            : 'exclude'
          : 'ignore',
      instructors: Array.from(instructorUIDSVWC.get()),
    };
    return result;
  };

  const getCurrentFilterAPI = (): LibraryFilterAPI => convertLibraryFilterToAPI(getCurrentFilter());

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
        gridSizeVWC={ctx.windowSizeImmediate}
        justifyContent="flex-start">
        <ScreenHeader
          close={{
            variant: screen.parameters.close.variant,
            onClick: (e) => {
              e.preventDefault();
              configurableScreenOut(
                workingVWC,
                startPop,
                transition,
                screen.parameters.close.exit,
                screen.parameters.close.trigger,
                {
                  parameters: {
                    filter: getCurrentFilterAPI(),
                  },
                  afterDone: () => {
                    trace({ type: 'close', filter: getCurrentFilterAPI() });
                  },
                }
              );
            },
          }}
          text={screen.parameters.header}
          windowWidth={windowWidthVWC}
          contentWidth={ctx.contentWidth}
        />
        <VerticalSpacer height={20} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.label}>Favorites</div>
          <VerticalSpacer height={8} />
          <SurveyCheckboxGroup
            choices={[{ slug: 'favorites', element: <>Favorites</> }] as const}
            checked={favoritesVWC}
            variant="square"
            uncheck
          />
        </ContentContainer>
        <VerticalSpacer height={24} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.label}>Taken</div>
          <VerticalSpacer height={8} />
          <SurveyCheckboxGroup
            choices={
              [
                { slug: 'taken', element: <>Taken</> },
                { slug: 'not-taken', element: <>Not Taken</> },
              ] as const
            }
            checked={takenVWC}
            variant="round"
            uncheck
          />
        </ContentContainer>
        <VerticalSpacer height={24} />
        <ContentContainer contentWidthVWC={ctx.contentWidth}>
          <div className={styles.label}>Instructors</div>
          <VerticalSpacer height={8} />
          <RenderGuardedComponent
            props={resources.instructors}
            component={(c) => {
              if (c === null) {
                return (
                  <InlineOsehSpinner
                    size={{
                      type: 'react-rerender',
                      props: {
                        width: 24,
                      },
                    }}
                  />
                );
              }

              if (c === undefined) {
                return (
                  <div className={styles.error}>
                    <div className={styles.errorText}>
                      Cannot load the instructor list. Try again or contact support by emailing
                      hi@oseh.com
                    </div>
                  </div>
                );
              }

              return (
                <InstructorCheckboxGroup instructors={c} instructorUIDSVWC={instructorUIDSVWC} />
              );
            }}
          />
        </ContentContainer>
      </GridContentContainer>
      {screen.parameters.cta !== null ? (
        <GridContentContainer
          gridSizeVWC={ctx.windowSizeImmediate}
          contentWidthVWC={windowWidthVWC}
          justifyContent="flex-start"
          noPointerEvents>
          <VerticalSpacer height={0} flexGrow={1} />
          <div className={styles.cta}>
            <Button
              type="button"
              variant="filled-white"
              onClick={(e) => {
                e.preventDefault();
                const cta = screen.parameters.cta;
                if (cta === null) {
                  return;
                }
                configurableScreenOut(workingVWC, startPop, transition, cta.exit, cta.trigger, {
                  parameters: {
                    filter: getCurrentFilterAPI(),
                  },
                  afterDone: () => {
                    trace({ type: 'cta', filter: getCurrentFilterAPI() });
                  },
                });
              }}>
              {screen.parameters.cta.text}
            </Button>
          </div>
          <VerticalSpacer height={32} />
        </GridContentContainer>
      ) : null}
      <WipeTransitionOverlay wipe={transitionState.wipe} />
    </GridFullscreenContainer>
  );
};

const InstructorCheckboxGroup = ({
  instructors,
  instructorUIDSVWC,
}: {
  instructors: SearchPublicInstructor[];
  instructorUIDSVWC: WritableValueWithCallbacks<Set<string>>;
}): ReactElement => {
  const choices = useMemo(() => {
    return instructors.map((i) => ({
      slug: i.uid,
      element: <>{i.name}</>,
    }));
  }, [instructors]);

  const checkedWVWC = useMemo(
    (): SurveyCheckboxGroupProps<string>['checked'] => ({
      get: () => {
        const set = instructorUIDSVWC.get();
        if (set.size === 0) {
          return instructors.map((i) => i.uid);
        }
        return Array.from(set);
      },
      set: (v) => {
        if (v.length === instructors.length) {
          setVWC(instructorUIDSVWC, new Set(), () => false);
          return;
        }

        setVWC(instructorUIDSVWC, new Set(v), () => false);
      },
      callbacks: new Callbacks(),
    }),
    [instructorUIDSVWC]
  );

  return (
    <SurveyCheckboxGroup
      choices={choices}
      checked={checkedWVWC}
      variant="square"
      uncheck
      multiple
    />
  );
};
