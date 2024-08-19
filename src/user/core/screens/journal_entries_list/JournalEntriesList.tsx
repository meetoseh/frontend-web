import { ReactElement, useCallback, useMemo } from 'react';
import { PeekedScreen, ScreenComponentProps } from '../../models/Screen';
import { JournalEntriesListMappedParams } from './JournalEntriesListParams';
import { JournalEntriesListResources } from './JournalEntriesListResources';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import {
  useWritableValueWithCallbacks,
  ValueWithCallbacks,
} from '../../../../shared/lib/Callbacks';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { Button } from '../../../../shared/forms/Button';
import styles from './JournalEntriesList.module.css';
import { JournalEntry } from './lib/JournalEntry';
import { ScreenContext } from '../../hooks/useScreenContext';
import { useStyleVWC } from '../../../../shared/hooks/useStyleVWC';
import { setVWC } from '../../../../shared/lib/setVWC';
import { JournalEntryCard } from './components/JournalEntryCard';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import {
  InfiniteListing,
  NetworkedInfiniteListing,
  PrefixedNetworkedInfiniteListing,
} from '../../../../shared/lib/InfiniteListing';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { InfiniteList } from '../../../../shared/components/InfiniteList';
import { ContentContainer } from '../../../../shared/components/ContentContainer';

type TooltipPlaceholder = { readonly uid: 'tooltip' };

/**
 * Shows the list of journal entries the user has written, typically in
 * descending order of canonical time.
 */
export const JournalEntriesList = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<
  'journal_entries_list',
  JournalEntriesListResources,
  JournalEntriesListMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const isErrorVWC = useMappedValueWithCallbacks(resources.list, (list) => list === undefined);
  useValueWithCallbacksEffect(isErrorVWC, (isError) => {
    if (isError) {
      trace({
        type: 'error',
        listUndefined: resources.list.get() === undefined,
      });
    }
    return undefined;
  });

  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (size) => size.width);

  const gotoJournalEntry = useCallback(
    (journalEntry: JournalEntry) => {
      configurableScreenOut(
        workingVWC,
        startPop,
        transition,
        screen.parameters.close.exit,
        screen.parameters.journalEntryTrigger,
        {
          parameters: {
            journal_entry_uid: journalEntry.uid,
          },
        }
      );
    },
    [screen.parameters, workingVWC, startPop, transition]
  );
  const editJournalEntry = useCallback(
    (journalEntry: JournalEntry) => {
      configurableScreenOut(
        workingVWC,
        startPop,
        transition,
        screen.parameters.close.exit,
        screen.parameters.journalEntryEditTrigger,
        {
          parameters: {
            journal_entry_uid: journalEntry.uid,
          },
        }
      );
    },
    [screen.parameters, workingVWC, startPop, transition]
  );

  const boundComponent = useMemo<
    (
      item: ValueWithCallbacks<JournalEntry | TooltipPlaceholder>,
      setItem: (newItem: JournalEntry | TooltipPlaceholder) => void
    ) => ReactElement
  >(() => {
    return (item) => (
      <JournalEntryComponentWrapper
        gotoJournalEntry={gotoJournalEntry}
        editJournalEntry={editJournalEntry}
        item={item}
        ctx={ctx}
        screen={screen}
      />
    );
  }, [ctx, screen, gotoJournalEntry, editJournalEntry]);

  const listHeight = useMappedValueWithCallbacks(
    ctx.windowSizeImmediate,
    (size) => size.height - 54 /* screen header */ - 32 /* avoid being too tight */
  );

  const mappedListVWC = useMappedValueWithCallbacks(
    resources.list,
    (list): InfiniteListing<JournalEntry | TooltipPlaceholder> | null => {
      if (list === null || list === undefined) {
        return null;
      }

      if (screen.parameters.tooltip === null) {
        return list.listing as NetworkedInfiniteListing<JournalEntry | TooltipPlaceholder>;
      }

      return new PrefixedNetworkedInfiniteListing<JournalEntry, TooltipPlaceholder>(list.listing, [
        { uid: 'tooltip' },
      ]) as any as NetworkedInfiniteListing<JournalEntry | TooltipPlaceholder>;
    },
    {
      inputEqualityFn: () => false,
    }
  );

  return (
    <GridFullscreenContainer windowSizeImmediate={ctx.windowSizeImmediate}>
      <GridDarkGrayBackground />
      <GridContentContainer
        gridSizeVWC={ctx.windowSizeImmediate}
        contentWidthVWC={windowWidthVWC}
        left={transitionState.left}
        opacity={transitionState.opacity}
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
                  afterDone: () => {
                    trace({ type: 'close' });
                  },
                }
              );
            },
          }}
          text={screen.parameters.header}
          windowWidth={windowWidthVWC}
          contentWidth={ctx.contentWidth}
        />
        <VerticalSpacer height={26} />
        <RenderGuardedComponent
          props={useMappedValuesWithCallbacks(
            [mappedListVWC, listHeight],
            () => ({
              list: mappedListVWC.get(),
              listHeight: listHeight.get(),
            }),
            {
              outputEqualityFn: (a, b) =>
                Object.is(a.list, b.list) && a.listHeight === b.listHeight,
            }
          )}
          component={({ list, listHeight }) =>
            list === null ? (
              <></>
            ) : (
              <InfiniteList
                listing={list}
                component={boundComponent}
                itemComparer={compareJournalEntries}
                height={listHeight}
                gap={10}
                initialComponentHeight={292}
                emptyElement={
                  <RenderGuardedComponent
                    props={ctx.contentWidth}
                    component={(cw) => (
                      <div className={styles.empty} style={{ maxWidth: `${cw}px` }}>
                        You haven't completed any journal entries yet.
                      </div>
                    )}
                  />
                }
                noScrollBar
              />
            )
          }
        />
        <VerticalSpacer height={0} flexGrow={1} />
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
                  afterDone: () => {
                    trace({ type: 'cta' });
                  },
                });
              }}>
              {screen.parameters.cta.text}
            </Button>
          </div>
          <VerticalSpacer height={32} />
        </GridContentContainer>
      ) : null}
    </GridFullscreenContainer>
  );
};

const compareJournalEntries = (
  a: JournalEntry | TooltipPlaceholder,
  b: JournalEntry | TooltipPlaceholder
): boolean => a.uid === b.uid;

const JournalEntryComponentWrapper = ({
  gotoJournalEntry: gotoJournalEntryOuter,
  editJournalEntry: editJournalEntryOuter,
  item: itemVWC,
  screen,
  ctx,
}: {
  gotoJournalEntry: (journalEntry: JournalEntry) => void;
  editJournalEntry: (journalEntry: JournalEntry) => void;
  item: ValueWithCallbacks<JournalEntry | TooltipPlaceholder>;
  screen: PeekedScreen<string, JournalEntriesListMappedParams>;
  ctx: ScreenContext;
}): ReactElement => {
  const isTooltipVWC = useMappedValueWithCallbacks(itemVWC, (item) => item.uid === 'tooltip');
  return (
    <RenderGuardedComponent
      props={isTooltipVWC}
      component={(isTooltip) =>
        isTooltip ? (
          <Tooltip ctx={ctx} screen={screen} />
        ) : (
          <JournalEntryComponent
            gotoJournalEntry={gotoJournalEntryOuter}
            editJournalEntry={editJournalEntryOuter}
            item={itemVWC as ValueWithCallbacks<JournalEntry>}
            ctx={ctx}
          />
        )
      }
    />
  );
};

const Tooltip = ({
  ctx,
  screen,
}: {
  ctx: ScreenContext;
  screen: PeekedScreen<string, JournalEntriesListMappedParams>;
}): ReactElement => {
  const tooltipRefVWC = useWritableValueWithCallbacks<HTMLDivElement | null>(() => null);
  const tooltipStyleVWC = useMappedValueWithCallbacks(ctx.contentWidth, (width) => ({
    width: `${width}px`,
  }));
  useStyleVWC(tooltipRefVWC, tooltipStyleVWC);
  return (
    <div className={styles.tooltipContainer}>
      <div
        className={styles.tooltip}
        style={tooltipStyleVWC.get()}
        ref={(r) => setVWC(tooltipRefVWC, r)}>
        <div className={styles.tooltipHeader}>
          {screen.parameters.tooltip?.header ?? 'Tooltip Header'}
        </div>
        <div style={{ height: '8px' }} />
        <div className={styles.tooltipBody}>
          {screen.parameters.tooltip?.body ?? 'Tooltip Body'}
        </div>
      </div>
    </div>
  );
};

const JournalEntryComponent = ({
  gotoJournalEntry: gotoJournalEntryOuter,
  editJournalEntry: editJournalEntryOuter,
  item: itemVWC,
  ctx,
}: {
  gotoJournalEntry: (journalEntry: JournalEntry) => void;
  editJournalEntry: (journalEntry: JournalEntry) => void;
  item: ValueWithCallbacks<JournalEntry>;
  ctx: ScreenContext;
}): ReactElement => {
  return (
    <JournalEntryCard
      onClick={useCallback(
        () => gotoJournalEntryOuter(itemVWC.get()),
        [itemVWC, gotoJournalEntryOuter]
      )}
      onEditClick={useCallback(
        () => editJournalEntryOuter(itemVWC.get()),
        [itemVWC, editJournalEntryOuter]
      )}
      journalEntry={itemVWC}
      ctx={ctx}
    />
  );
};
