import { Fragment, ReactElement } from 'react';
import { ScreenComponentProps } from '../../models/Screen';
import { useEntranceTransition, useTransitionProp } from '../../../../shared/lib/TransitionProp';
import {
  StandardScreenTransition,
  useStandardTransitionsState,
} from '../../../../shared/hooks/useStandardTransitions';
import { useWritableValueWithCallbacks } from '../../../../shared/lib/Callbacks';
import { GridFullscreenContainer } from '../../../../shared/components/GridFullscreenContainer';
import { GridDarkGrayBackground } from '../../../../shared/components/GridDarkGrayBackground';
import { GridContentContainer } from '../../../../shared/components/GridContentContainer';
import { useMappedValueWithCallbacks } from '../../../../shared/hooks/useMappedValueWithCallbacks';
import { useValueWithCallbacksEffect } from '../../../../shared/hooks/useValueWithCallbacksEffect';
import { ScreenHeader } from '../../../../shared/components/ScreenHeader';
import { RenderGuardedComponent } from '../../../../shared/components/RenderGuardedComponent';
import { configurableScreenOut } from '../../lib/configurableScreenOut';
import { VerticalSpacer } from '../../../../shared/components/VerticalSpacer';
import { InlineOsehSpinner } from '../../../../shared/components/InlineOsehSpinner';
import styles from './JournalEntrySummary.module.css';
import { Button } from '../../../../shared/forms/Button';
import { ContentContainer } from '../../../../shared/components/ContentContainer';
import { IconButton } from '../../../../shared/forms/IconButton';
import { Regenerate } from '../../../../shared/components/icons/Regenerate';
import { OsehColors } from '../../../../shared/OsehColors';
import { HorizontalSpacer } from '../../../../shared/components/HorizontalSpacer';
import { Edit } from '../../../../shared/components/icons/Edit';
import { setVWC } from '../../../../shared/lib/setVWC';
import { JournalEntrySummaryResources } from './JournalEntrySummaryResources';
import { JournalEntrySummaryMappedParams } from './JournalEntrySummaryParams';
import { Close } from '../../../../shared/components/icons/Close';
import { Plus } from '../../../../shared/components/icons/Plus';
import { useMappedValuesWithCallbacks } from '../../../../shared/hooks/useMappedValuesWithCallbacks';
import { TagText } from './components/TagText';

/**
 * Shows the journal entry summary and allows editing it
 */
export const JournalEntrySummary = ({
  ctx,
  screen,
  resources,
  startPop,
  trace,
}: ScreenComponentProps<
  'journal_entry_summary',
  JournalEntrySummaryResources,
  JournalEntrySummaryMappedParams
>): ReactElement => {
  const transition = useTransitionProp((): StandardScreenTransition => screen.parameters.entrance);
  useEntranceTransition(transition);

  const transitionState = useStandardTransitionsState(transition);

  const workingVWC = useWritableValueWithCallbacks(() => false);

  const isErrorVWC = useMappedValueWithCallbacks(resources.summary, (q) => q === undefined);
  useValueWithCallbacksEffect(isErrorVWC, (isError) => {
    if (isError) {
      trace({ type: 'error', hint: 'summary is undefined' });
    }
    return undefined;
  });

  const isReadyToContinueVWC = useMappedValueWithCallbacks(
    resources.summary,
    (q) => q !== null && q !== undefined
  );
  useValueWithCallbacksEffect(isReadyToContinueVWC, (isReady) => {
    if (isReady) {
      trace({ type: 'ready' });
    }
    return undefined;
  });

  const windowWidthVWC = useMappedValueWithCallbacks(ctx.windowSizeImmediate, (size) => size.width);

  const headerWithClose = (
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
  );

  const editingVWC = useWritableValueWithCallbacks(() => false);
  const editedTitleVWC = useWritableValueWithCallbacks<string>(() => '');

  const editedTagsVWC = useWritableValueWithCallbacks<string[]>(() => []);
  const addingTagVWC = useWritableValueWithCallbacks(() => false);
  const editTagsAddTagValueVWC = useWritableValueWithCallbacks<string>(() => '');

  const onAddTag = () => {
    const newTag = editTagsAddTagValueVWC.get().trim();
    if (newTag !== '') {
      editedTagsVWC.get().push(newTag);
      editedTagsVWC.callbacks.call(undefined);
    }

    setVWC(addingTagVWC, false);
    setVWC(editTagsAddTagValueVWC, '');
  };

  const onSubmitEdit = () => {
    if (!editingVWC.get()) {
      return;
    }

    const newTitle = (editedTitleVWC.get() ?? '').trim();
    const newTags = editedTagsVWC.get().slice();

    const existing = resources.summary.get();
    if (existing === null || existing === undefined) {
      return;
    }

    if (
      newTitle === '' ||
      (newTitle === existing.data.title &&
        newTags.length === existing.data.tags.length &&
        newTags.every((t, i) => t === existing.data.tags[i]))
    ) {
      setVWC(editingVWC, false);
      setVWC(editedTitleVWC, '');
      setVWC(editedTagsVWC, []);
      return;
    }

    resources.trySubmitEdit({ type: 'summary', version: 'v1', title: newTitle, tags: newTags });
    setVWC(editingVWC, false);
    setVWC(editedTitleVWC, '');
    setVWC(editedTagsVWC, []);
  };

  const editedTitleAndAddingVWC = useMappedValuesWithCallbacks(
    [editedTitleVWC, addingTagVWC],
    () => ({
      title: editedTitleVWC.get(),
      adding: addingTagVWC.get(),
    })
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
        {screen.parameters.close.onlyIfError ? (
          <RenderGuardedComponent
            props={isErrorVWC}
            component={(isError) =>
              !isError ? (
                <ScreenHeader
                  close={null}
                  text={screen.parameters.header}
                  windowWidth={windowWidthVWC}
                  contentWidth={ctx.contentWidth}
                />
              ) : (
                headerWithClose
              )
            }
          />
        ) : (
          headerWithClose
        )}
        <RenderGuardedComponent
          props={editingVWC}
          component={(editing) =>
            editing ? (
              <>
                <VerticalSpacer height={0} flexGrow={1} />
                <ContentContainer contentWidthVWC={ctx.contentWidth}>
                  <RenderGuardedComponent
                    props={editedTitleAndAddingVWC}
                    component={({ title, adding }) =>
                      adding ? (
                        <div className={styles.title}>{title}</div>
                      ) : (
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="Title (3-4 words)"
                          value={title}
                          onChange={(e) => setVWC(editedTitleVWC, e.target.value)}
                        />
                      )
                    }
                    applyInstantly
                  />
                </ContentContainer>
                <VerticalSpacer height={0} maxHeight={8} flexGrow={1} />
                <ContentContainer contentWidthVWC={ctx.contentWidth}>
                  <RenderGuardedComponent
                    props={editedTagsVWC}
                    component={(tags) => (
                      <div className={styles.rowWrap}>
                        {tags.map((tag, i) => (
                          <Fragment key={i}>
                            {i > 0 && <HorizontalSpacer width={16} />}
                            <div className={styles.column}>
                              <VerticalSpacer height={16} />
                              <div className={styles.tag}>
                                <div className={styles.column}>
                                  <div className={styles.row}>
                                    <HorizontalSpacer width={8} />
                                    <TagText tag={tag} />
                                    <HorizontalSpacer width={10} />
                                    <IconButton
                                      icon={
                                        <Close
                                          icon={{ width: 16 }}
                                          container={{ width: 24, height: 34 }}
                                          color={OsehColors.v4.primary.smoke}
                                          startPadding={{
                                            x: { fraction: 0 },
                                            y: { fraction: 0.5 },
                                          }}
                                        />
                                      }
                                      srOnlyName="Edit"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        editedTagsVWC.get().splice(i, 1);
                                        editedTagsVWC.callbacks.call(undefined);
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Fragment>
                        ))}
                        <RenderGuardedComponent
                          props={addingTagVWC}
                          component={(adding) =>
                            adding ? (
                              <></>
                            ) : (
                              <>
                                {tags.length > 0 && <HorizontalSpacer width={16} />}
                                <div className={styles.column}>
                                  <VerticalSpacer height={16} />
                                  <div className={styles.tag}>
                                    <IconButton
                                      icon={
                                        <Plus
                                          icon={{
                                            width: 24,
                                          }}
                                          container={{
                                            width: 36,
                                            height: 36,
                                          }}
                                          startPadding={{
                                            x: {
                                              fraction: 0.5,
                                            },
                                            y: {
                                              fraction: 0.5,
                                            },
                                          }}
                                          color={OsehColors.v4.primary.light}
                                        />
                                      }
                                      srOnlyName="Add Tag"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setVWC(addingTagVWC, true);
                                      }}
                                    />
                                  </div>
                                </div>
                              </>
                            )
                          }
                        />
                      </div>
                    )}
                  />
                </ContentContainer>
                <RenderGuardedComponent
                  props={addingTagVWC}
                  component={(adding) =>
                    !adding ? (
                      <></>
                    ) : (
                      <>
                        <VerticalSpacer height={0} maxHeight={24} flexGrow={1} />
                        <ContentContainer contentWidthVWC={ctx.contentWidth}>
                          <RenderGuardedComponent
                            props={editTagsAddTagValueVWC}
                            component={(value) => (
                              <input
                                type="text"
                                className={styles.input}
                                placeholder="Enter your tag here"
                                value={value}
                                onChange={(e) => setVWC(editTagsAddTagValueVWC, e.target.value)}
                              />
                            )}
                            applyInstantly
                          />
                        </ContentContainer>
                      </>
                    )
                  }
                />
                <VerticalSpacer height={0} maxHeight={32} flexGrow={1} />
                <ContentContainer contentWidthVWC={ctx.contentWidth}>
                  <Button
                    type="button"
                    variant="filled-white"
                    onClick={(e) => {
                      e.preventDefault();
                      if (addingTagVWC.get()) {
                        onAddTag();
                      } else {
                        onSubmitEdit();
                      }
                    }}>
                    <RenderGuardedComponent
                      props={addingTagVWC}
                      component={(adding) => (adding ? <>Add Tag</> : <>Finish Editing</>)}
                    />
                  </Button>
                </ContentContainer>
                <VerticalSpacer height={0} maxHeight={32} flexGrow={1} />
              </>
            ) : (
              <>
                <VerticalSpacer height={0} flexGrow={1} />
                <RenderGuardedComponent
                  props={resources.summary}
                  component={(summary) =>
                    summary === null ? (
                      <div className={styles.spinner}>
                        <InlineOsehSpinner
                          size={{
                            type: 'react-rerender',
                            props: {
                              width: 64,
                            },
                          }}
                          variant="white-thin"
                        />
                      </div>
                    ) : summary === undefined ? (
                      <ContentContainer contentWidthVWC={ctx.contentWidth}>
                        <div className={styles.error}>
                          Something went wrong loading your summary. Try again or contact support at
                          hi@oseh.com
                        </div>
                      </ContentContainer>
                    ) : (
                      <>
                        <ContentContainer contentWidthVWC={ctx.contentWidth}>
                          <div className={styles.title}>{summary.data.title}</div>
                        </ContentContainer>
                        <VerticalSpacer height={0} maxHeight={8} flexGrow={1} />
                        <ContentContainer contentWidthVWC={ctx.contentWidth}>
                          <div className={styles.rowWrap}>
                            {summary.data.tags.map((tag, i) => (
                              <Fragment key={i}>
                                {i > 0 && <HorizontalSpacer width={16} />}
                                <div className={styles.column}>
                                  <VerticalSpacer height={16} />
                                  <div className={styles.tag}>
                                    <div className={styles.column}>
                                      <VerticalSpacer height={5} />
                                      <div className={styles.row}>
                                        <HorizontalSpacer width={8} />
                                        <TagText tag={tag} />
                                        <HorizontalSpacer width={8} />
                                      </div>
                                      <VerticalSpacer height={5} />
                                    </div>
                                  </div>
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        </ContentContainer>
                      </>
                    )
                  }
                />
                {screen.parameters.hint && (
                  <>
                    <VerticalSpacer height={0} maxHeight={64} flexGrow={2} />
                    <ContentContainer contentWidthVWC={ctx.contentWidth}>
                      <div className={styles.hint}>{screen.parameters.hint}</div>
                    </ContentContainer>
                  </>
                )}
                <VerticalSpacer height={0} flexGrow={1} />
                <ContentContainer contentWidthVWC={ctx.contentWidth}>
                  <RenderGuardedComponent
                    props={isReadyToContinueVWC}
                    component={(isReady) => (
                      <Button
                        type="button"
                        variant="filled-white"
                        onClick={(e) => {
                          e.preventDefault();
                          if (!isReady) {
                            return;
                          }
                          configurableScreenOut(
                            workingVWC,
                            startPop,
                            transition,
                            screen.parameters.cta.exit,
                            screen.parameters.cta.trigger,
                            {
                              afterDone: () => {
                                trace({ type: 'cta' });
                              },
                            }
                          );
                        }}
                        disabled={!isReady}>
                        {screen.parameters.cta.text}
                      </Button>
                    )}
                  />
                </ContentContainer>
                {screen.parameters.regenerate !== null || screen.parameters.edit !== null ? (
                  <>
                    <VerticalSpacer height={12} />
                    <div className={styles.buttons}>
                      <HorizontalSpacer width={0} flexGrow={1} />
                      {screen.parameters.regenerate !== null && (
                        <IconButton
                          icon={
                            <Regenerate
                              icon={{ width: 16 }}
                              container={{ width: 48, height: 48 }}
                              color={OsehColors.v4.primary.smoke}
                              startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                            />
                          }
                          srOnlyName="Regenerate"
                          onClick={(e) => {
                            e.preventDefault();
                            resources.tryRegenerate();
                          }}
                        />
                      )}
                      {screen.parameters.regenerate !== null && screen.parameters.edit !== null && (
                        <HorizontalSpacer width={4} />
                      )}
                      {screen.parameters.edit !== null && (
                        <IconButton
                          icon={
                            <Edit
                              icon={{ width: 17 }}
                              container={{ width: 48, height: 48 }}
                              color={OsehColors.v4.primary.smoke}
                              startPadding={{ x: { fraction: 0.5 }, y: { fraction: 0.5 } }}
                            />
                          }
                          srOnlyName="Edit"
                          onClick={(e) => {
                            e.preventDefault();
                            const summary = resources.summary.get();
                            if (summary !== null && summary !== undefined) {
                              setVWC(editedTitleVWC, summary.data.title);
                              setVWC(editedTagsVWC, summary.data.tags.slice());
                              setVWC(addingTagVWC, false);
                              setVWC(editTagsAddTagValueVWC, '');
                              setVWC(editingVWC, true);
                            }
                          }}
                        />
                      )}
                      <HorizontalSpacer width={0} flexGrow={1} />
                    </div>
                  </>
                ) : undefined}
                <VerticalSpacer height={32} />
              </>
            )
          }
        />
      </GridContentContainer>
    </GridFullscreenContainer>
  );
};
