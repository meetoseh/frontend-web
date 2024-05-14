import { ReactElement, memo, useCallback, useEffect } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithTypedCallbacks,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import { setVWC } from '../../../shared/lib/setVWC';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';
import styles from './DraggableTable.module.css';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';

export type ReindexEvent<T extends object> = {
  /**
   * Indicates that the change occurred by the user dragging a row over
   * another row, adjacent to it. This means that the only change is the
   * index of the two rows swapped.
   *
   * The mutation is equivalent to
   * ```js
   * ele = items.splice(index1, 1)[0];
   * items.splice(index2, 0, ele);
   * ```
   */
  type: 'reindex';
  /** The index of the element removed */
  index1: number;
  /** The adjacent index that the element was inserted into */
  index2: number;
  /** The element that was moved */
  ele: T;
};

export type AddEvent<T extends object> = {
  /**
   * Indicates that a new element was added to the list. We don't actually emit this
   * event, but we have an optimized flow when receiving it as an event since its
   * extremely common functionality with this table.
   *
   * Implemented as if by
   * ```
   * arr.splice(index, 0, item);
   * ```
   */
  type: 'add';

  /**
   * The index at which the element was added.
   */
  index: number;

  /**
   * The element that was added.
   */
  item: T;
};

export type RemoveEvent<T extends object> = {
  /**
   * Indicates that an element was removed from the list. We don't actually emit this
   * event, but we have an optimized flow when receiving it as an event since its
   * extremely common functionality with this table.
   *
   * Implemented as if by
   * ```
   * arr.splice(index, 1);
   * ```
   */
  type: 'remove';

  /**
   * The index of the removed item
   */
  index: number;

  /**
   * The removed item
   */
  item: T;
};

export type ReplaceEvent<T extends object> = {
  /**
   * Indicates that an element was replaced in the list. We don't actually emit this
   * event, but we have an optimized flow when receiving it as an event since its
   * extremely common functionality with this table.
   */
  type: 'replace';

  /**
   * The index of the replaced item
   */
  index: number;

  /**
   * The original value of the item
   */
  original: T;

  /**
   * The new value of the item
   */
  replaced: T;
};

export type DraggableTableMutationEvent<T extends object> =
  | ReindexEvent<T>
  | AddEvent<T>
  | RemoveEvent<T>
  | ReplaceEvent<T>;

export type DraggableTableProps<T extends object> = {
  /**
   * The element to render as the table header.
   *
   * Ex:
   * ```tsx
   * <thead>
   *   <tr>
   *     <th>Column 1</th>
   *   </tr>
   * </thead>
   * ```
   */
  thead: ReactElement;

  /**
   * The number of columns in the thead. Does not need to be specified
   * if the thead is defined in the expected way as it can be fetched
   * from its props, otherwise, it must be specified to correctly set
   * the colspan on spacer rows.
   */
  numberOfColumns?: number;

  /**
   * The items in the table. We will always write events, but we can receive
   * updates without events at a performance cost.
   */
  items: WritableValueWithTypedCallbacks<T[], DraggableTableMutationEvent<T> | undefined>;

  /**
   * Renders the given item as a fragment containing one td (table data) per
   * column. This does not need `key` prop within the returned element. The
   * item is effectively memo'd, regardless of it's actually wrapped in React.memo
   * itself.
   *
   * The `tr` is not included in the item because we handle drag listeners on
   * it.
   *
   * Example:
   * ```tsx
   * const MyItem = ({ item }) => (
   *   <>
   *     <td>{item.column1}</td>
   *   </>
   * )} />
   * ```
   */
  render: (item: T) => ReactElement;

  /**
   * Maps items to the key for rendering purposes, so that mutating the list
   * doesn't require re-rendering all items.
   */
  keyFn: (item: T) => string;

  /**
   * If specified, a double click handler is attached to rows and this function
   * is called with the item that was double clicked (after preventing the default
   * action of the event).
   */
  onExpandRow?: (item: T) => void;
};

type Dragging<T extends object> = { item: T; index: number };
const areDraggingEqual = <T extends object>(
  a: Dragging<T> | undefined,
  b: Dragging<T> | undefined
) =>
  a === undefined || b === undefined ? a === b : a.index === b.index && Object.is(a.item, b.item);

/**
 * Renders a table where the user can drag to reorder.
 */
export const DraggableTable = <T extends object>({
  thead,
  items: itemsVWC,
  render,
  keyFn,
  onExpandRow,
}: DraggableTableProps<T>): ReactElement => {
  const draggingVWC = useWritableValueWithCallbacks<{ item: T; index: number } | undefined>(
    () => undefined
  );
  useEffect(() => {
    itemsVWC.callbacks.add(onUpdate);
    updateViaSearch();
    return () => {
      itemsVWC.callbacks.remove(onUpdate);
    };

    function onUpdate(info: DraggableTableMutationEvent<T> | undefined) {
      const dragging = draggingVWC.get();
      if (dragging === undefined) {
        return;
      }

      if (info === undefined) {
        updateViaSearch();
        return;
      }

      if (info.type === 'reindex') {
        checkCandidates([info.index1, info.index2]);
        return;
      }

      if (info.type === 'add') {
        if (info.index <= dragging.index) {
          checkCandidates([dragging.index + 1]);
        }
        return;
      }

      if (info.type === 'remove') {
        if (Object.is(info.item, dragging.item)) {
          setVWC(draggingVWC, undefined);
        }
        return;
      }

      if (info.type === 'replace') {
        // never alters the index
        updateViaSearch();
        return;
      }

      updateViaSearch();
    }

    function updateViaSearch() {
      const dragging = draggingVWC.get();
      if (dragging === undefined) {
        return;
      }

      const draggingKey = keyFn(dragging.item);

      const items = itemsVWC.get();
      const draggedIndex =
        dragging.index < items.length && draggingKey === keyFn(items[dragging.index])
          ? dragging.index
          : items.findIndex((m) => keyFn(m) === draggingKey);
      if (draggedIndex === -1) {
        // it was removed
        setVWC(draggingVWC, undefined);
        return;
      }

      setVWC(draggingVWC, { item: items[draggedIndex], index: draggedIndex }, areDraggingEqual);
    }

    function checkCandidates(indices: number[]) {
      const dragging = draggingVWC.get();
      if (dragging === undefined) {
        return;
      }

      const items = itemsVWC.get();
      for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        if (index < 0 || index >= items.length) {
          continue;
        }

        if (Object.is(dragging.item, items[index])) {
          if (index !== dragging.index) {
            setVWC(draggingVWC, { item: items[index], index });
          }
          return;
        }
      }

      updateViaSearch();
    }
  }, [itemsVWC, draggingVWC, keyFn]);

  const onPickupRow = useCallback(
    (ele: T): void => {
      const allItems = itemsVWC.get();
      const index = allItems.findIndex((m) => m === ele);
      if (index === -1) {
        throw new Error('onPickupRow called with element not in items');
      }
      setVWC(draggingVWC, { item: ele, index }, areDraggingEqual);
    },
    [itemsVWC, draggingVWC]
  );
  const onDragoverRow = useCallback(
    (draggingOver: T): void => {
      const dragging = draggingVWC.get();
      if (dragging === undefined) {
        return;
      }

      if (Object.is(dragging.item, draggingOver)) {
        return;
      }

      const items = itemsVWC.get();
      const draggingOverIndex = (() => {
        // siblings are much more likely
        let delta = 1;
        while (true) {
          const lower = dragging.index - delta;
          if (lower >= 0 && Object.is(items[lower], draggingOver)) {
            return lower;
          }

          const upper = dragging.index + delta;
          if (upper < items.length && Object.is(items[upper], draggingOver)) {
            return upper;
          }

          if (lower < 0 && upper >= items.length) {
            return -1;
          }
        }
      })();
      if (draggingOverIndex === -1) {
        return;
      }

      items.splice(dragging.index, 1);
      items.splice(draggingOverIndex, 0, dragging.item);
      itemsVWC.callbacks.call({
        type: 'reindex',
        index1: dragging.index,
        index2: draggingOverIndex,
        ele: dragging.item,
      });
    },
    [draggingVWC, itemsVWC]
  );
  const onDragEnd = useCallback(() => {
    setVWC(draggingVWC, undefined);
  }, [draggingVWC]);
  const tableRef = useWritableValueWithCallbacks<HTMLTableElement | null>(() => null);
  const isDraggingVWC = useMappedValueWithCallbacks(
    draggingVWC,
    (dragging) => dragging !== undefined
  );
  useMappedValuesWithCallbacks([tableRef, isDraggingVWC], () => {
    const tbl = tableRef.get();
    if (tbl === null) {
      return undefined;
    }
    const isDragging = isDraggingVWC.get();

    if (isDragging) {
      tbl.classList.add(styles.dragging);
    } else {
      tbl.classList.remove(styles.dragging);
    }
  });

  const renderedItemsVWC = useWritableValueWithCallbacks<ReactElement[]>(() => []);
  useEffect(() => {
    let current: ReactElement[] = [];
    itemsVWC.callbacks.add(onUpdate);
    onUpdate(undefined);
    return () => {
      itemsVWC.callbacks.remove(onUpdate);
    };

    function onUpdate(info: DraggableTableMutationEvent<T> | undefined) {
      if (info === undefined) {
        reconstruct();
        return;
      }

      if (info.type === 'reindex') {
        const ele = current.splice(info.index1, 1)[0];
        current.splice(info.index2, 0, ele);
        renderedItemsVWC.callbacks.call(undefined);
        return;
      }

      if (info.type === 'add') {
        const ele = makeItemRow(info.item);
        current.splice(info.index, 0, ele);
        renderedItemsVWC.callbacks.call(undefined);
        return;
      }

      if (info.type === 'remove') {
        current.splice(info.index, 1);
        renderedItemsVWC.callbacks.call(undefined);
        return;
      }

      if (info.type === 'replace') {
        const ele = makeItemRow(info.replaced);
        current[info.index] = ele;
        renderedItemsVWC.callbacks.call(undefined);
        return;
      }

      reconstruct();
    }

    function reconstruct() {
      const items = itemsVWC.get();
      const newItems: ReactElement[] = [];
      for (let i = 0; i < items.length; i++) {
        const ele = items[i];
        newItems.push(makeItemRow(ele));
      }

      current = newItems;
      setVWC(renderedItemsVWC, newItems);
    }

    function makeItemRow(ele: T): ReactElement {
      return (
        <ItemRow
          key={keyFn(ele)}
          render={render}
          ele={ele}
          dragging={draggingVWC}
          onPickupRow={onPickupRow}
          onDragoverElementRow={onDragoverRow}
          onDragEnd={onDragEnd}
          onExpandRow={onExpandRow}
        />
      );
    }
  }, [
    itemsVWC,
    renderedItemsVWC,
    draggingVWC,
    keyFn,
    onDragEnd,
    onDragoverRow,
    onExpandRow,
    onPickupRow,
    render,
  ]);

  return (
    <table
      className={combineClasses(
        styles.table,
        draggingVWC.get() !== undefined ? styles.dragging : undefined
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        setVWC(draggingVWC, undefined);
      }}
      ref={(r) => setVWC(tableRef, r)}>
      {thead}
      <tbody>
        <RenderGuardedComponent props={renderedItemsVWC} component={(itms) => <>{itms}</>} />
      </tbody>
    </table>
  );
};

const _ItemRow = <T extends object>({
  render,
  ele,
  dragging: draggingVWC,
  onPickupRow,
  onDragoverElementRow,
  onDragEnd,
  onExpandRow,
}: {
  render: DraggableTableProps<T>['render'];
  ele: T;
  dragging: ValueWithCallbacks<{ item: T; index: number } | undefined>;
  onPickupRow: (ele: T) => void;
  onDragoverElementRow: (ele: T) => void;
  onDragEnd: () => void;
  onExpandRow?: (ele: T) => void;
}): ReactElement => {
  const isDraggingVWC = useMappedValueWithCallbacks(
    draggingVWC,
    (dragging) => dragging !== undefined && Object.is(dragging.item, ele)
  );

  const trRef = useWritableValueWithCallbacks<HTMLTableRowElement | null>(() => null);
  useMappedValuesWithCallbacks([trRef, isDraggingVWC], () => {
    const tr = trRef.get();
    if (tr === null) {
      return undefined;
    }

    const isDragging = isDraggingVWC.get();
    if (isDragging) {
      tr.classList.add(styles.dragging);
    } else {
      tr.classList.remove(styles.dragging);
    }
    return undefined;
  });

  return (
    <tr
      draggable
      ref={(r) => setVWC(trRef, r)}
      className={isDraggingVWC.get() ? styles.dragging : undefined}
      onDragStart={useCallback(
        (e: React.DragEvent<HTMLTableRowElement>) => {
          onPickupRow(ele);
        },
        [ele, onPickupRow]
      )}
      onDragOver={useCallback(
        (e: React.DragEvent<HTMLTableRowElement>) => {
          onDragoverElementRow(ele);
        },
        [ele, onDragoverElementRow]
      )}
      onDragEnd={() => {
        onDragEnd();
      }}
      onDoubleClick={
        onExpandRow === undefined
          ? undefined
          : (e) => {
              e.preventDefault();
              onExpandRow(ele);
            }
      }>
      {render(ele)}
    </tr>
  );
};

const ItemRow = memo(_ItemRow) as typeof _ItemRow;
