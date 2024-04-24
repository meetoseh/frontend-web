import { ReactElement, memo, useCallback, useEffect, useRef } from 'react';
import {
  ValueWithCallbacks,
  WritableValueWithTypedCallbacks,
  createWritableValueWithCallbacks,
  downgradeTypedVWC,
  useWritableValueWithCallbacks,
} from '../../../shared/lib/Callbacks';
import styles from './PriorityDraggableTable.module.css';
import { setVWC } from '../../../shared/lib/setVWC';
import { RenderGuardedComponent } from '../../../shared/components/RenderGuardedComponent';
import { useMappedValueWithCallbacks } from '../../../shared/hooks/useMappedValueWithCallbacks';
import { findLastIndex } from '../../../shared/lib/findLastIndex';
import { combineClasses } from '../../../shared/lib/combineClasses';
import { useMappedValuesWithCallbacks } from '../../../shared/hooks/useMappedValuesWithCallbacks';

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

export type ReprioritizeEvent<T extends object> = {
  /**
   * Indicates that element was either the first at its priority and had
   * its priority reduced by 1, or was the last in its priority and had its
   * priority increased by 1.
   *
   * I.e., in the simple scenario (see `scenario`), the mutation is:
   *
   * ```js
   * original = items[index]
   * items[index] = priority.copySet(original, priority.get(original) + (change === 'reduce' ? -1 : 1));
   * ```
   */
  type: 'reprioritize';
  /**
   * As part of this mutation, we consider if we need to mutate all the
   * priorities in order to keep the lowest priority at 1 and avoid gaps
   *
   * - simple: There were other elements at the same priority and in the new priority.
   *   The above sample code works without modification.
   *
   * - increaseOthers: The element was at priority 1 and had its priority
   *   reduced. In this case, everything else is shifted up 1 priority instead.
   *
   *   NOTE: It can be assumed that there were other elements at priority 1 in this case.
   *
   *     If there was nothing else at priority 1, this would result in a gap at
   *     priority 2, which would then need to be fixed by reducing all greater
   *     priorities by 1, which would result in no change and this event not
   *     being emitted.
   *
   * - decreaseHigher: The element was not the highest priority and had its
   *   priority increased, but there was nothing else at its old priority. In
   *   this case, the elements priority is unchanged and all greater priorities
   *   are shifted down 1 instead.
   *
   * - applyAndDecreaseHigher: The element was not the highest priority and had its priority
   *   decreased, but there was nothing else at its old priority. In this case,
   *   the elements priority is still decreased, but in addition all greater
   *   priorities are shifted down 1. Since the element was the only one in its
   *   old priority, a simple way to think about this is decrease greater than or
   *   equal to the old priority by 1.
   *
   * - create: The element was the highest priority and had its priority increased. This
   *   creates a new priority
   *
   *   NOTE:
   *     It can be assumed in this case that there were others at the same priority,
   *     since otherwise this would have resulted in a gap at the old priority, which
   *     would have been fixed by undoing the increase in priority, hence no change,
   *     and this event not being emitted.
   *
   * - mergeUp: The element was the only one at the highest priority and had its priority
   *   reduced, which removes the last priority
   */
  scenario:
    | 'simple'
    | 'increaseOthers'
    | 'decreaseHigher'
    | 'applyAndDecreaseHigher'
    | 'create'
    | 'mergeUp';
  /**
   * The index of the element that was changed.
   */
  index: number;
  /**
   * The direction we "changed" the priority of the element. Note that this is the
   * abstraction of what occurred, but the scenario determines how we apply this
   * change.
   */
  change: 'reduce' | 'increase';
  /**
   * The element prior to the change. This might match the element after the change,
   * for example, in the `increaseOthers` scenario.
   */
  original: T;
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

export type ReplaceEvent<T extends object> = {
  /**
   * Indicates that an element was replaced in the list. We don't actually emit this
   * event, but we have an optimized flow when receiving it as an event since its
   * extremely common functionality with this table.
   *
   * This cannot be used to change the priority of the item.
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

export type PriorityDraggableTableMutationEvent<T extends object> =
  | ReindexEvent<T>
  | ReprioritizeEvent<T>
  | AddEvent<T>
  | ReplaceEvent<T>;

export type PriorityDraggableTableProps<T extends object> = {
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
   * The items in the table, in ascending order of priority. It's expected to
   * have repeated priorities. We will always write events, but we can receive
   * updates without events at a performance cost.
   */
  items: WritableValueWithTypedCallbacks<T[], PriorityDraggableTableMutationEvent<T> | undefined>;

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
   * The getter/setter for the priority of an item, which is a number that
   * the items are sorted by in ascending order and for which there can be
   * duplicates.
   */
  priority: {
    /** Gets the priority of the given item */
    get: (item: T) => number;

    /** Returns a new item which is a copy of the given item, but with the given priority */
    copySet: (item: T, priority: number) => T;

    /**
     * Renders the given priority value in a string (or formatted string) for a row header.
     * `undefined` is treated as if by
     *
     * ```js
     * (p) => `Priority ${p}`
     * ```
     */
    render?: (priority: number) => ReactElement | string;

    /**
     * The contents for the row separator that creates a new priority greater than
     * all existing priorities. `undefined` is treated as if by `'Add Priority'`.
     */
    newPriority?: ReactElement | string;
  };

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

/**
 * Renders a table where the items can be dragged to be rearranged or to update
 * their priority. Typically, the priority is _not_ included in the rendered
 * rows, since it will be injected with row separators.
 *
 * IMPORTANT:
 *   This requires that the items in the array are always copied, never mutated.
 *   It supports the array being mutated without copying, so long as the
 *   callbacks are invoked correctly.
 */
export const PriorityDraggableTable = <T extends object>({
  thead,
  numberOfColumns: numberOfColumnsOpt,
  items: itemsVWC,
  render,
  priority,
  keyFn,
  onExpandRow,
}: PriorityDraggableTableProps<T>): ReactElement => {
  const numberOfColumns = numberOfColumnsOpt ?? thead.props.children.props.children.length;

  // We maintain a separate identifier for each priority so that we can use
  // it as the key for which priorities to render, so that they don't need to
  // be remounted on move.
  //
  // Suppose we start with 5 elements in priority 1. This will be converted
  // to a priority map { 1: 0 }
  //
  // Then 1 element is shifted "up", which results in 1 element in priority 1
  // and 2 elements in priority 2. It's faster, in this case, to mutate 1 to
  // 2 then 1 to 0. Hence, the priority map becomes { 1: 1, 2: 0 }.
  //
  // If that element is shifted back "down" to 2, we end up with the original list,
  // and get a priority map of { 1: 0 }.
  //
  // This trick only works when array mutation info is available.

  const nextPriorityIdRef = useRef(10000); // for debugging nicer than 0
  const priorityToPriorityIdMapVWC = useWritableValueWithCallbacks<Map<number, number>>(() => {
    const res = new Map<number, number>();
    const items = itemsVWC.get();

    for (let i = 0; i < itemsVWC.get().length; i++) {
      const itemPriority = priority.get(items[i]);
      if (!res.has(itemPriority)) {
        res.set(itemPriority, nextPriorityIdRef.current++);
      }
    }
    return res;
  });
  const priorityIdToPriorityMapVWC = useWritableValueWithCallbacks<Map<number, number>>(() => {
    const res = new Map<number, number>();
    const map = priorityToPriorityIdMapVWC.get();
    let iter = map.entries();
    let next = iter.next();
    while (!next.done) {
      const [priority, id] = next.value;
      res.set(id, priority);
      next = iter.next();
    }
    return res;
  });
  const itemsByPriorityIdVWC = useWritableValueWithCallbacks<Map<number, ValueWithCallbacks<T[]>>>(
    () => {
      const res: Map<number, ValueWithCallbacks<T[]>> = new Map();
      const items = itemsVWC.get();
      const map = priorityToPriorityIdMapVWC.get();

      for (let i = 0; i < items.length; i++) {
        const prio = priority.get(items[i]);
        const prioId = map.get(prio);
        if (prioId === undefined) {
          throw new Error(`priority ${prio} not found in inverted priority map`);
        }

        let prioItems = res.get(prioId);
        if (prioItems === undefined) {
          prioItems = createWritableValueWithCallbacks<T[]>([]);
          res.set(prioId, prioItems);
        }
        prioItems.get().push(items[i]);
      }

      return res;
    }
  );

  // keys priorityMap, invertedPriorityMap, and itemsByPriorityId accurate,
  // only invoking their callbacks after all 3 are updated
  useEffect(() => {
    itemsVWC.callbacks.add(onUpdate);
    ensureConsistency();
    return () => {
      itemsVWC.callbacks.remove(onUpdate);
    };

    function onUpdate(info: PriorityDraggableTableMutationEvent<T> | undefined) {
      if (info === undefined) {
        ensureConsistency();
        return;
      }

      if (info.type === 'reindex') {
        const changedPriority = priority.get(info.ele);
        const changedPriorityId = priorityToPriorityIdMapVWC.get().get(changedPriority);
        if (changedPriorityId === undefined) {
          throw new Error(`reindex: changedPriorityId not found for priority ${changedPriority}`);
        }
        const itemsByPrioId = itemsByPriorityIdVWC.get();
        const subitemsVWC = itemsByPrioId.get(changedPriorityId);
        if (subitemsVWC === undefined) {
          throw new Error(`reindex: subitems not found for priority ${changedPriorityId}`);
        }
        const subitems = subitemsVWC.get();
        const changedIndex = subitems.findIndex((m) => keyFn(m) === keyFn(info.ele));
        if (changedIndex === -1) {
          throw new Error('reindex: changedIndex not found');
        }
        const otherIndex = changedIndex + (info.index2 - info.index1);
        subitems.splice(changedIndex, 1);
        subitems.splice(otherIndex, 0, info.ele);
        subitemsVWC.callbacks.call(undefined);
        return;
      }

      if (info.type === 'reprioritize') {
        if (info.scenario === 'simple') {
          const originalPriority = priority.get(info.original);

          const map = priorityToPriorityIdMapVWC.get();
          const originalPriorityId = map.get(originalPriority);
          if (originalPriorityId === undefined) {
            throw new Error(
              `reprioritize (simple): originalPriorityId not found for priority ${originalPriority}`
            );
          }
          const subitemsByPriorityId = itemsByPriorityIdVWC.get();

          const originalSubitemsVWC = subitemsByPriorityId.get(originalPriorityId);
          if (originalSubitemsVWC === undefined) {
            throw new Error(
              `reprioritize (simple): originalSubitems not found for priority ${originalPriorityId}`
            );
          }

          const originalSubitems = originalSubitemsVWC.get();

          if (info.change === 'reduce') {
            if (originalSubitems[0] !== info.original) {
              throw new Error(
                'reprioritize (simple, reduce): originalSubitems[0] !== info.original'
              );
            }

            const previousPriorityId = map.get(originalPriority - 1);
            if (previousPriorityId === undefined) {
              throw new Error(
                `reprioritize (simple, reduce): previousPriorityId not found for priority ${
                  originalPriority - 1
                }`
              );
            }
            const previousSubitemsVWC = subitemsByPriorityId.get(previousPriorityId);
            if (previousSubitemsVWC === undefined) {
              throw new Error(
                `reprioritize (simple, reduce): previousSubitems not found for priority ${previousPriorityId}`
              );
            }

            originalSubitems.splice(0, 1);
            previousSubitemsVWC.get().push(itemsVWC.get()[info.index]);

            originalSubitemsVWC.callbacks.call(undefined);
            previousSubitemsVWC.callbacks.call(undefined);
          } else {
            if (originalSubitems[originalSubitems.length - 1] !== info.original) {
              throw new Error(
                'reprioritize (simple, increase): originalSubitems[originalSubitems.length - 1] !== info.original'
              );
            }

            const nextPriorityId = map.get(originalPriority + 1);
            if (nextPriorityId === undefined) {
              throw new Error(
                `reprioritize (simple, increase): nextPriorityId not found for priority ${
                  originalPriority + 1
                }`
              );
            }

            const nextSubitemsVWC = subitemsByPriorityId.get(nextPriorityId);
            if (nextSubitemsVWC === undefined) {
              throw new Error(
                `reprioritize (simple, increase): nextSubitems not found for priority ${nextPriorityId}`
              );
            }

            originalSubitems.splice(originalSubitems.length - 1, 1);
            nextSubitemsVWC.get().unshift(itemsVWC.get()[info.index]);

            originalSubitemsVWC.callbacks.call(undefined);
            nextSubitemsVWC.callbacks.call(undefined);
          }
        } else if (info.scenario === 'increaseOthers') {
          const map = priorityToPriorityIdMapVWC.get();
          const items = itemsVWC.get();
          const newMap = new Map<number, number>();
          const newInvertedMap = new Map<number, number>();

          let iter = map.entries();
          let next = iter.next();
          while (!next.done) {
            const [priority, id] = next.value;
            newMap.set(priority + 1, id);
            newInvertedMap.set(id, priority + 1);

            next = iter.next();
          }
          newMap.set(1, nextPriorityIdRef.current++);
          newInvertedMap.set(nextPriorityIdRef.current - 1, 1);

          const now2PriorityId = newMap.get(2);
          if (now2PriorityId === undefined) {
            throw new Error('increaseOthers now2PriorityId is undefined');
          }
          const new1PriorityId = newMap.get(1);
          if (new1PriorityId === undefined) {
            throw new Error('increaseOthers new1PriorityId is undefined');
          }
          const subitemsMap = itemsByPriorityIdVWC.get();
          const now2Subitems = subitemsMap.get(now2PriorityId);
          if (now2Subitems === undefined) {
            throw new Error('increaseOthers now2Subitems is undefined');
          }
          const new1Subitems = createWritableValueWithCallbacks<T[]>([items[0]]);
          subitemsMap.set(new1PriorityId, new1Subitems);

          now2Subitems.get().shift();

          // update all references since their priority changed
          let prio = 2;
          let subindex = 0;
          for (let i = 1; i < items.length; i++) {
            if (priority.get(items[i]) !== prio) {
              prio++;
              subindex = 0;
            }

            const prioId = newMap.get(prio);
            if (prioId === undefined) {
              throw new Error(`increaseOthers prioId is undefined for priority ${prio}`);
            }
            const subitems = subitemsMap.get(prioId);
            if (subitems === undefined) {
              throw new Error(`increaseOthers subitems is undefined for priority ${prioId}`);
            }
            subitems.get()[subindex] = items[i];
            subindex++;
          }

          priorityToPriorityIdMapVWC.set(newMap);
          priorityIdToPriorityMapVWC.set(newInvertedMap);
          priorityToPriorityIdMapVWC.callbacks.call(undefined);
          priorityIdToPriorityMapVWC.callbacks.call(undefined);
          {
            const iter = subitemsMap.values();
            let next = iter.next();
            while (!next.done) {
              next.value.callbacks.call(undefined);
              next = iter.next();
            }
          }
          itemsByPriorityIdVWC.callbacks.call(undefined);
        } else if (
          info.scenario === 'decreaseHigher' ||
          info.scenario === 'applyAndDecreaseHigher'
        ) {
          const map = priorityToPriorityIdMapVWC.get();
          const imap = priorityIdToPriorityMapVWC.get();
          const subitemsMap = itemsByPriorityIdVWC.get();
          const items = itemsVWC.get();

          const prio = priority.get(info.original);
          const removedId = map.get(prio);
          if (removedId === undefined) {
            throw new Error(`${info.scenario} removedId is undefined`);
          }
          map.delete(prio);
          imap.delete(removedId);
          subitemsMap.delete(removedId);

          let nextPriority = prio + 1;
          while (true) {
            const oldId = map.get(nextPriority);
            if (oldId === undefined) {
              break;
            }

            map.delete(nextPriority);
            map.set(nextPriority - 1, oldId);
            imap.set(oldId, nextPriority - 1);

            nextPriority++;
          }

          let iterPrio = prio;
          let nextSubindex = 0;

          if (info.scenario === 'applyAndDecreaseHigher') {
            const previousPrio = prio - 1;
            const previousPrioId = map.get(previousPrio);
            if (previousPrioId === undefined) {
              throw new Error(`${info.scenario}: previousPrioId is undefined`);
            }
            const previousSubitemsVWC = subitemsMap.get(previousPrioId);
            if (previousSubitemsVWC === undefined) {
              throw new Error(`${info.scenario}: previousSubitems is undefined`);
            }

            const prioId = map.get(prio);
            if (prioId === undefined) {
              throw new Error(`${info.scenario}: prioId is undefined for priority ${prio}`);
            }

            const subitemsVWC = subitemsMap.get(prioId);
            if (subitemsVWC === undefined) {
              throw new Error(`${info.scenario}: subitems is undefined for priority ${prio}`);
            }

            subitemsVWC.get().shift();
            previousSubitemsVWC.get().push(info.original); // will update ref in a sec

            iterPrio = prio - 1;
            nextSubindex = previousSubitemsVWC.get().length - 1;
          }

          for (let i = info.index; i < items.length; i++) {
            if (priority.get(items[i]) !== iterPrio) {
              iterPrio++;
              nextSubindex = 0;
            }

            const prioId = map.get(iterPrio);
            if (prioId === undefined) {
              throw new Error(`${info.scenario}: prioId is undefined for priority ${iterPrio}`);
            }

            const subitems = subitemsMap.get(prioId);
            if (subitems === undefined) {
              throw new Error(`${info.scenario}: subitems is undefined for priority ${prioId}`);
            }

            subitems.get()[nextSubindex] = items[i];
            nextSubindex++;
          }

          priorityToPriorityIdMapVWC.callbacks.call(undefined);
          priorityIdToPriorityMapVWC.callbacks.call(undefined);
          itemsByPriorityIdVWC.callbacks.call(undefined);

          const maxPrio = priority.get(items[items.length - 1]);
          for (
            let changedPrio = prio - (info.scenario === 'applyAndDecreaseHigher' ? 1 : 0);
            changedPrio <= maxPrio;
            changedPrio++
          ) {
            const changedPriorityId = map.get(changedPrio);
            if (changedPriorityId === undefined) {
              throw new Error(
                `${info.scenario}: changedPriorityId is undefined for priority ${changedPrio}`
              );
            }
            const changedSubitemsVWC = subitemsMap.get(changedPriorityId);
            if (changedSubitemsVWC === undefined) {
              throw new Error(
                `${info.scenario}: changedSubitems is undefined for priority ${changedPrio}`
              );
            }
            changedSubitemsVWC.callbacks.call(undefined);
          }
        } else if (info.scenario === 'create') {
          const items = itemsVWC.get();
          const map = priorityToPriorityIdMapVWC.get();
          const imap = priorityIdToPriorityMapVWC.get();
          const newHighestPriority = priority.get(items[items.length - 1]);
          const newHighestPriorityId = nextPriorityIdRef.current++;
          map.set(newHighestPriority, newHighestPriorityId);
          imap.set(newHighestPriorityId, newHighestPriority);

          const subitemsMap = itemsByPriorityIdVWC.get();
          const oldHighestPriorityId = map.get(newHighestPriority - 1);
          if (oldHighestPriorityId === undefined) {
            throw new Error('create: oldHighestPriorityId is undefined');
          }

          const oldHighestSubitemsVWC = subitemsMap.get(oldHighestPriorityId);
          if (oldHighestSubitemsVWC === undefined) {
            throw new Error('create: oldHighestSubitems is undefined');
          }

          oldHighestSubitemsVWC.get().pop();

          const newHighestSubitemsVWC = createWritableValueWithCallbacks<T[]>([
            items[items.length - 1],
          ]);
          subitemsMap.set(newHighestPriorityId, newHighestSubitemsVWC);

          priorityToPriorityIdMapVWC.callbacks.call(undefined);
          priorityIdToPriorityMapVWC.callbacks.call(undefined);
          oldHighestSubitemsVWC.callbacks.call(undefined);
          itemsByPriorityIdVWC.callbacks.call(undefined);
        } else if (info.scenario === 'mergeUp') {
          const map = priorityToPriorityIdMapVWC.get();
          const imap = priorityIdToPriorityMapVWC.get();
          const subitemsMap = itemsByPriorityIdVWC.get();
          const items = itemsVWC.get();

          const removedPriority = priority.get(info.original);
          const removedId = map.get(removedPriority);
          if (removedId === undefined) {
            throw new Error('mergeUp: removedId is undefined');
          }
          map.delete(removedPriority);
          imap.delete(removedId);
          subitemsMap.delete(removedId);

          const newLastPriority = removedPriority - 1;
          const newLastPriorityId = map.get(newLastPriority);
          if (newLastPriorityId === undefined) {
            throw new Error('mergeUp: newLastPriorityId is undefined');
          }

          const newLastSubitemsVWC = subitemsMap.get(newLastPriorityId);
          if (newLastSubitemsVWC === undefined) {
            throw new Error('mergeUp: newLastSubitems is undefined');
          }

          newLastSubitemsVWC.get().push(items[items.length - 1]);

          priorityToPriorityIdMapVWC.callbacks.call(undefined);
          priorityIdToPriorityMapVWC.callbacks.call(undefined);
          newLastSubitemsVWC.callbacks.call(undefined);
          itemsByPriorityIdVWC.callbacks.call(undefined);
        }
        return;
      }

      if (info.type === 'add') {
        const map = priorityToPriorityIdMapVWC.get();
        const addedPriority = priority.get(info.item);
        const items = itemsVWC.get();
        const subitemsMap = itemsByPriorityIdVWC.get();

        if (!map.has(addedPriority)) {
          const imap = priorityIdToPriorityMapVWC.get();
          const addedPriorityId = nextPriorityIdRef.current++;
          map.set(addedPriority, addedPriorityId);
          imap.set(addedPriorityId, addedPriority);

          const newSubitems = createWritableValueWithCallbacks<T[]>([info.item]);
          subitemsMap.set(addedPriorityId, newSubitems);

          priorityToPriorityIdMapVWC.callbacks.call(undefined);
          priorityIdToPriorityMapVWC.callbacks.call(undefined);
          itemsByPriorityIdVWC.callbacks.call(undefined);
          return;
        }

        if (info.index === 0) {
          // add to top
          const topPriorityId = map.get(addedPriority);
          if (topPriorityId === undefined) {
            throw new Error('add: topPriorityId is undefined');
          }

          const topSubitemsVWC = subitemsMap.get(topPriorityId);
          if (topSubitemsVWC === undefined) {
            throw new Error('add: topSubitems is undefined');
          }

          topSubitemsVWC.get().unshift(info.item);
          topSubitemsVWC.callbacks.call(undefined);
          return;
        }

        if (info.index === items.length - 1) {
          // add to bottom
          const bottomPriorityId = map.get(addedPriority);
          if (bottomPriorityId === undefined) {
            throw new Error('add: bottomPriorityId is undefined');
          }

          const bottomSubitemsVWC = subitemsMap.get(bottomPriorityId);
          if (bottomSubitemsVWC === undefined) {
            throw new Error('add: bottomSubitems is undefined');
          }

          bottomSubitemsVWC.get().push(info.item);
          bottomSubitemsVWC.callbacks.call(undefined);
          return;
        }

        // add in middle
        const middlePriorityId = map.get(addedPriority);
        if (middlePriorityId === undefined) {
          throw new Error('add: middlePriorityId is undefined');
        }

        const middleSubitemsVWC = subitemsMap.get(middlePriorityId);
        if (middleSubitemsVWC === undefined) {
          throw new Error('add: middleSubitems is undefined');
        }
        const middleSubitems = middleSubitemsVWC.get();

        const oldItemAtThisIndex = items[info.index + 1]; // it was shoved right
        const middleIndex = middleSubitems.findIndex((m) => Object.is(m, oldItemAtThisIndex));
        if (middleIndex === -1) {
          throw new Error('add: middleIndex is -1');
        }

        middleSubitems.splice(middleIndex, 0, info.item);
        middleSubitemsVWC.callbacks.call(undefined);
        return;
      }

      if (info.type === 'replace') {
        const map = priorityToPriorityIdMapVWC.get();
        const subitemsMap = itemsByPriorityIdVWC.get();

        const changedPriority = priority.get(info.replaced);
        if (changedPriority !== priority.get(info.original)) {
          throw new Error('replace: cannot use replace to change priority');
        }

        const changedPriorityId = map.get(changedPriority);
        if (changedPriorityId === undefined) {
          throw new Error(`replace: changedPriorityId not found for priority ${changedPriority}`);
        }

        const subitemsVWC = subitemsMap.get(changedPriorityId);
        if (subitemsVWC === undefined) {
          throw new Error(`replace: subitems not found for priority ${changedPriorityId}`);
        }

        const subitems = subitemsVWC.get();
        const changedIndex = subitems.findIndex((m) => Object.is(m, info.original));
        subitems[changedIndex] = info.replaced;
        subitemsVWC.callbacks.call(undefined);
        return;
      }

      ensureConsistency();
    }

    /**
     * Verifies that priorityMapVWC is a valid priority map for the
     * current itemsVWC. This is only needed on mount when the items
     * may have drifted between the time the priority map was created
     * and when this effect runs, or when no mutation info is provided
     * and thus we can't use that to determine if there is a better way
     * to update the map.
     *
     * A priority map is valid if it contains all priorities in the
     * items list. Any missing priorities are added with new priority
     * IDs.
     */
    function ensureConsistency() {
      const items = itemsVWC.get();
      const map = priorityToPriorityIdMapVWC.get();
      const invertedMap = priorityIdToPriorityMapVWC.get();
      for (let i = 0; i < items.length; i++) {
        const itemPriority = priority.get(items[i]);
        if (!map.has(itemPriority)) {
          map.set(itemPriority, nextPriorityIdRef.current++);
          invertedMap.set(nextPriorityIdRef.current - 1, itemPriority);
        }
      }

      const newSubitemsMap = new Map<number, ValueWithCallbacks<T[]>>();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemPriority = priority.get(item);
        const itemPriorityId = map.get(itemPriority);
        if (itemPriorityId === undefined) {
          throw new Error(
            `ensureConsistency: itemPriorityId not found for priority ${itemPriority}`
          );
        }

        let subitemsVWC = newSubitemsMap.get(itemPriorityId);
        if (subitemsVWC === undefined) {
          subitemsVWC = createWritableValueWithCallbacks<T[]>([]);
          newSubitemsMap.set(itemPriorityId, subitemsVWC);
        }
        subitemsVWC.get().push(item);
      }
      itemsByPriorityIdVWC.set(newSubitemsMap);

      priorityToPriorityIdMapVWC.callbacks.call(undefined);
      priorityIdToPriorityMapVWC.callbacks.call(undefined);
      itemsByPriorityIdVWC.callbacks.call(undefined);
    }
  }, [
    itemsVWC,
    priorityIdToPriorityMapVWC,
    priority,
    priorityToPriorityIdMapVWC,
    itemsByPriorityIdVWC,
    keyFn,
  ]);

  const draggingVWC = useWritableValueWithCallbacks<{ item: T; index: number } | undefined>(
    () => undefined
  );
  useEffect(() => {
    itemsVWC.callbacks.add(onUpdate);
    updateViaSearch();
    return () => {
      itemsVWC.callbacks.remove(onUpdate);
    };

    function onUpdate(info: PriorityDraggableTableMutationEvent<T> | undefined) {
      const dragging = draggingVWC.get();
      if (dragging === undefined) {
        return;
      }

      if (info === undefined) {
        updateViaSearch();
        return;
      }

      if (info.type === 'reindex') {
        return; // never alters the item
      }

      if (info.type === 'reprioritize') {
        // never alters the index
        updateViaSearch();
        return;
      }

      if (info.type === 'add') {
        return; // never alters the item
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
        draggingKey === keyFn(items[dragging.index])
          ? dragging.index
          : items.findIndex((m) => keyFn(m) === draggingKey);
      if (draggedIndex === -1) {
        // it was removed
        setVWC(draggingVWC, undefined);
        return;
      }

      setVWC(draggingVWC, { item: items[draggedIndex], index: draggedIndex }, (a, b) =>
        a === undefined || b === undefined
          ? a === b
          : a.index === b.index && Object.is(a.item, b.item)
      );
    }
  }, [itemsVWC, draggingVWC, keyFn]);

  const lastPriorityVWC = useMappedValueWithCallbacks(downgradeTypedVWC(itemsVWC), (items) =>
    items.length === 0 ? 0 : priority.get(items[items.length - 1])
  );

  const simulateRepeatedDragUp = useCallback(
    (num: number) => {
      const onDragoverElementRow = onDragoverElementRowRef.current;
      const onDragoverPriorityRow = onDragoverPriorityRowRef.current;
      for (let i = 0; i < num; i++) {
        const dragging = draggingVWC.get();
        if (dragging === undefined) {
          return;
        }

        if (dragging.index === 0) {
          onDragoverPriorityRow(1);
          return;
        }

        const items = itemsVWC.get();
        const previousElement = items[dragging.index - 1];
        const draggingPriority = priority.get(dragging.item);
        if (draggingPriority === priority.get(previousElement)) {
          onDragoverElementRow(previousElement);
        } else {
          onDragoverPriorityRow(draggingPriority);
        }
      }
    },
    [itemsVWC, draggingVWC, priority]
  );

  const simulateRepeatedDragDown = useCallback(
    (num: number) => {
      const onDragoverElementRow = onDragoverElementRowRef.current;
      const onDragoverPriorityRow = onDragoverPriorityRowRef.current;

      for (let i = 0; i < num; i++) {
        const dragging = draggingVWC.get();
        if (dragging === undefined) {
          return;
        }

        const draggingPriority = priority.get(dragging.item);

        const items = itemsVWC.get();
        if (dragging.index === items.length - 1) {
          onDragoverPriorityRow(draggingPriority + 1);
          return;
        }

        const nextElement = items[dragging.index + 1];
        if (draggingPriority === priority.get(nextElement)) {
          onDragoverElementRow(nextElement);
        } else {
          onDragoverPriorityRow(draggingPriority + 1);
        }
      }
    },
    [itemsVWC, draggingVWC, priority]
  );

  const onPickupRow = useCallback(
    (ele: T): void => {
      const allItems = itemsVWC.get();
      const index = allItems.findIndex((m) => m === ele);
      if (index === -1) {
        throw new Error('onPickupRow called with element not in items');
      }
      setVWC(draggingVWC, { item: ele, index }, (a, b) =>
        a === undefined || b === undefined
          ? a === b
          : a.index === b.index && Object.is(a.item, b.item)
      );
    },
    [itemsVWC, draggingVWC]
  );
  const onDragoverElementRow = useCallback(
    (draggingOver: T): void => {
      const dragging = draggingVWC.get();
      if (dragging === undefined) {
        return;
      }

      if (Object.is(dragging.item, draggingOver)) {
        return;
      }

      const items = itemsVWC.get();

      if (dragging.index > 0 && Object.is(items[dragging.index - 1], draggingOver)) {
        if (priority.get(dragging.item) !== priority.get(draggingOver)) {
          // skipped over the spacer
          simulateRepeatedDragUp(2);
          return;
        }

        items.splice(dragging.index, 1);
        items.splice(dragging.index - 1, 0, dragging.item);
        draggingVWC.set({ item: dragging.item, index: dragging.index - 1 });
        checkInvariants(items, priority);
        itemsVWC.callbacks.call({
          type: 'reindex',
          index1: dragging.index,
          index2: dragging.index - 1,
          ele: dragging.item,
        });
        draggingVWC.callbacks.call(undefined);
        return;
      }

      if (dragging.index < items.length - 1 && Object.is(items[dragging.index + 1], draggingOver)) {
        if (priority.get(dragging.item) !== priority.get(draggingOver)) {
          // skipped over the spacer
          simulateRepeatedDragDown(2);
          return;
        }

        checkInvariants(items, priority);
        items.splice(dragging.index, 1);
        items.splice(dragging.index + 1, 0, dragging.item);
        draggingVWC.set({ item: dragging.item, index: dragging.index + 1 });
        checkInvariants(items, priority);
        itemsVWC.callbacks.call({
          type: 'reindex',
          index1: dragging.index,
          index2: dragging.index + 1,
          ele: dragging.item,
        });
        draggingVWC.callbacks.call(undefined);
        return;
      }

      // they skipped over some stuff
      const draggingOverIndex = items.findIndex((m) => Object.is(m, draggingOver));
      if (draggingOverIndex === -1) {
        throw new Error('onDragoverElementRow: draggingOver not found in items');
      }

      if (draggingOverIndex < dragging.index) {
        const numSpacers = priority.get(dragging.item) - priority.get(draggingOver);
        simulateRepeatedDragUp(numSpacers + dragging.index - draggingOverIndex);
      } else {
        const numSpacers = priority.get(draggingOver) - priority.get(dragging.item);
        simulateRepeatedDragDown(numSpacers + draggingOverIndex - dragging.index);
      }
    },
    [draggingVWC, itemsVWC, priority, simulateRepeatedDragDown, simulateRepeatedDragUp]
  );
  const onDragoverElementRowRef = useRef(onDragoverElementRow);
  onDragoverElementRowRef.current = onDragoverElementRow;

  const onDragoverPriorityRow = useCallback(
    (draggedOverPriority: number): void => {
      const dragging = draggingVWC.get();
      if (dragging === undefined) {
        return;
      }

      const items = itemsVWC.get();
      if (items.length <= 1) {
        return;
      }
      const draggedPriority = priority.get(dragging.item);

      if (draggedOverPriority === draggedPriority) {
        // dragging up decreases priority.

        if (dragging.index !== 0 && priority.get(items[dragging.index - 1]) === draggedPriority) {
          // they skipped over some stuff
          let numSkippedUps = 1;
          while (
            dragging.index - numSkippedUps - 1 >= 0 &&
            priority.get(items[dragging.index - numSkippedUps - 1]) === draggedPriority
          ) {
            numSkippedUps++;
          }
          simulateRepeatedDragUp(numSkippedUps + 1);
          return;
        }

        if (draggedOverPriority === 1) {
          // we can't actually decrease this items priority, but we can do what
          // the user wants (make this one lower priority than the rest), by moving
          // the rest, unless that doesn't do anything
          if (priority.get(items[1]) !== 1) {
            // this doesn't do anything as there are no other items at priority 1, i.e.,
            // it's already lower priority than everything
            return;
          }

          for (let i = 1; i < items.length; i++) {
            items[i] = priority.copySet(items[i], priority.get(items[i]) + 1);
          }
          checkInvariants(items, priority);
          itemsVWC.callbacks.call({
            type: 'reprioritize',
            scenario: 'increaseOthers',
            index: 0,
            change: 'reduce',
            original: items[0],
          });
          return;
        }

        if (
          dragging.index + 1 < items.length &&
          priority.get(items[dragging.index + 1]) !== draggedPriority
        ) {
          // we are the last at our priority and we are not the highest priority
          checkInvariants(items, priority);
          for (let i = dragging.index; i < items.length; i++) {
            items[i] = priority.copySet(items[i], priority.get(items[i]) - 1);
          }
          checkInvariants(items, priority);
          draggingVWC.set({ item: items[dragging.index], index: dragging.index });
          itemsVWC.callbacks.call({
            type: 'reprioritize',
            scenario: 'applyAndDecreaseHigher',
            index: dragging.index,
            change: 'reduce',
            original: dragging.item,
          });
          draggingVWC.callbacks.call(undefined);
          return;
        }

        if (dragging.index === items.length - 1) {
          // we are the last and at the highest priority
          items[dragging.index] = priority.copySet(dragging.item, draggedPriority - 1);
          checkInvariants(items, priority);
          draggingVWC.set({ item: items[dragging.index], index: dragging.index });
          itemsVWC.callbacks.call({
            type: 'reprioritize',
            scenario: 'mergeUp',
            index: dragging.index,
            change: 'reduce',
            original: dragging.item,
          });
          draggingVWC.callbacks.call(undefined);
          return;
        }

        items[dragging.index] = priority.copySet(dragging.item, draggedPriority - 1);
        checkInvariants(items, priority);
        draggingVWC.set({ item: items[dragging.index], index: dragging.index });
        itemsVWC.callbacks.call({
          type: 'reprioritize',
          scenario: 'simple',
          index: dragging.index,
          change: 'reduce',
          original: dragging.item,
        });
        draggingVWC.callbacks.call(undefined);
      } else if (draggedOverPriority === draggedPriority + 1) {
        // dragging down increases priority

        if (
          dragging.index !== items.length - 1 &&
          priority.get(items[dragging.index + 1]) === draggedPriority
        ) {
          // they skipped over some stuff
          let numSkippedDowns = 1;
          while (
            dragging.index + numSkippedDowns + 1 < items.length &&
            priority.get(items[dragging.index + numSkippedDowns + 1]) === draggedPriority
          ) {
            numSkippedDowns++;
          }
          simulateRepeatedDragDown(numSkippedDowns + 1);
          return;
        }

        if (
          dragging.index < items.length - 1 &&
          (dragging.index === 0 || priority.get(items[dragging.index - 1]) < draggedPriority)
        ) {
          // we are not the highest priority and we are the last at our priority
          // instead of changing ours, change all later
          for (let i = dragging.index + 1; i < items.length; i++) {
            items[i] = priority.copySet(items[i], priority.get(items[i]) - 1);
          }
          checkInvariants(items, priority);
          itemsVWC.callbacks.call({
            type: 'reprioritize',
            scenario: 'decreaseHigher',
            index: dragging.index,
            change: 'increase',
            original: items[dragging.index],
          });
          return;
        }

        if (dragging.index === items.length - 1) {
          // we are at the highest priority

          if (priority.get(items[dragging.index - 1]) === draggedPriority) {
            // and there are others at this priority
            items[dragging.index] = priority.copySet(dragging.item, draggedPriority + 1);
            checkInvariants(items, priority);
            draggingVWC.set({ item: items[dragging.index], index: dragging.index });
            itemsVWC.callbacks.call({
              type: 'reprioritize',
              scenario: 'create',
              index: dragging.index,
              change: 'increase',
              original: dragging.item,
            });
            draggingVWC.callbacks.call(undefined);
          } else {
            // and there are no others at this priority, which means theres nothing to do
            // as we're already higher priority than everything
          }
          return;
        }

        items[dragging.index] = priority.copySet(dragging.item, draggedPriority + 1);
        checkInvariants(items, priority);
        draggingVWC.set({ item: items[dragging.index], index: dragging.index });
        itemsVWC.callbacks.call({
          type: 'reprioritize',
          scenario: 'simple',
          index: dragging.index,
          change: 'increase',
          original: dragging.item,
        });
        draggingVWC.callbacks.call(undefined);
      } else if (draggedOverPriority < draggedPriority) {
        // they skipped a lot of stuff

        const firstIndexAtTargetPriority = items.findIndex(
          (i) => priority.get(i) === draggedOverPriority
        );
        if (firstIndexAtTargetPriority === -1) {
          throw new Error('onDragoverPriorityRow: firstIndexAtTargetPriority is -1');
        }

        const numSpacers = draggedPriority - draggedOverPriority;
        simulateRepeatedDragUp(numSpacers + dragging.index - firstIndexAtTargetPriority + 1);
      } else {
        // they skipped a lot of stuff going down
        const lastIndexAtLowerPriority = findLastIndex(
          items,
          (i) => priority.get(i) < draggedOverPriority
        );
        if (lastIndexAtLowerPriority === -1) {
          throw new Error('onDragoverPriorityRow: lastIndexAtLowerPriority is -1');
        }

        const numSpacers = draggedOverPriority - draggedPriority;
        simulateRepeatedDragDown(numSpacers + lastIndexAtLowerPriority - dragging.index + 1);
      }
    },
    [draggingVWC, priority, itemsVWC, simulateRepeatedDragDown, simulateRepeatedDragUp]
  );
  const onDragoverPriorityRowRef = useRef(onDragoverPriorityRow);
  onDragoverPriorityRowRef.current = onDragoverPriorityRow;

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
        <RenderGuardedComponent
          props={priorityToPriorityIdMapVWC}
          component={(dangerousPriorityMap) => {
            // CARE: dangerousPriorityMap can mutate on us whenever we call
            // something that might either yield or mutate itemsVWC

            let elements: ReactElement[] = [];
            let prio = 1;
            const lastPriority = lastPriorityVWC.get();
            while (prio <= lastPriority) {
              const priorityId = dangerousPriorityMap.get(prio);
              if (priorityId === undefined) {
                throw new Error(
                  `Priority ${prio} not found in priority map, despite last priority ${lastPriority}`
                );
              }
              const subitemsVWC = itemsByPriorityIdVWC.get().get(priorityId);
              if (subitemsVWC === undefined) {
                throw new Error(`Priority ${prio} not found in itemsByPriorityId`);
              }
              elements.push(
                <PriorityHandler
                  key={priorityId}
                  myPriorityId={priorityId}
                  priority={priority}
                  invertedPriorityMapVWC={priorityIdToPriorityMapVWC}
                  myItems={subitemsVWC}
                  numberOfColumns={numberOfColumns}
                  render={render}
                  dragging={draggingVWC}
                  onDragoverPriorityRow={onDragoverPriorityRow}
                  onDragoverElementRow={onDragoverElementRow}
                  onPickupRow={onPickupRow}
                  onDragEnd={onDragEnd}
                  keyFn={keyFn}
                  onExpandRow={onExpandRow}
                />
              );
              prio++;
            }
            return <>{elements}</>;
          }}
        />
        <RenderGuardedComponent
          props={lastPriorityVWC}
          component={(lastPriority) => (
            <tr onDragOver={() => onDragoverPriorityRow(lastPriority + 1)}>
              <th colSpan={numberOfColumns}>{renderPriority(priority, lastPriority + 1)}</th>
            </tr>
          )}
        />
      </tbody>
    </table>
  );
};

const _PriorityHandler = <T extends object>({
  myPriorityId,
  invertedPriorityMapVWC,
  priority,
  myItems: myItemsVWC,
  dragging,
  numberOfColumns,
  render,
  keyFn,
  onPickupRow,
  onDragoverPriorityRow,
  onDragoverElementRow,
  onDragEnd,
  onExpandRow,
}: {
  myPriorityId: number;
  invertedPriorityMapVWC: ValueWithCallbacks<Map<number, number>>;
  myItems: ValueWithCallbacks<T[]>;
  dragging: ValueWithCallbacks<{ item: T; index: number } | undefined>;
  numberOfColumns: number;
  onPickupRow: (ele: T) => void;
  onDragoverPriorityRow: (priority: number) => void;
  onDragoverElementRow: (ele: T) => void;
  onDragEnd: () => void;
  onExpandRow?: (ele: T) => void;
} & Pick<PriorityDraggableTableProps<T>, 'priority' | 'render' | 'keyFn'>): ReactElement => {
  const myPriorityVWC = useMappedValueWithCallbacks(invertedPriorityMapVWC, (imap) => {
    return imap.get(myPriorityId);
  });

  const onDragoverMyPriority = useCallback(() => {
    const myPriority = myPriorityVWC.get();
    if (myPriority !== undefined) {
      onDragoverPriorityRow(myPriority);
    }
  }, [myPriorityVWC, onDragoverPriorityRow]);

  return (
    <>
      <RenderGuardedComponent
        props={myPriorityVWC}
        component={(myPriority) => (
          <tr onDragOver={onDragoverMyPriority}>
            <th colSpan={numberOfColumns}>{renderPriority(priority, myPriority ?? 0)}</th>
          </tr>
        )}
      />
      <RenderGuardedComponent
        props={myItemsVWC}
        component={(items) => {
          const elements: ReactElement[] = [];
          for (let i = 0; i < items.length; i++) {
            const ele = items[i];
            elements.push(
              <ItemRow
                key={keyFn(ele)}
                render={render}
                ele={ele}
                dragging={dragging}
                onPickupRow={onPickupRow}
                onDragoverElementRow={onDragoverElementRow}
                onDragEnd={onDragEnd}
                onExpandRow={onExpandRow}
              />
            );
          }
          return <>{elements}</>;
        }}
      />
    </>
  );
};

const PriorityHandler = memo(_PriorityHandler) as typeof _PriorityHandler;

const _ItemRow = <T extends object>({
  render,
  ele,
  dragging: draggingVWC,
  onPickupRow,
  onDragoverElementRow,
  onDragEnd,
  onExpandRow,
}: {
  render: PriorityDraggableTableProps<T>['render'];
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

const renderPriority = <T extends object>(
  priority: PriorityDraggableTableProps<T>['priority'],
  value: number
) =>
  priority.render === undefined
    ? `Priority ${value.toLocaleString()}`
    : priority.render(value ?? 1);

function checkInvariants<T extends object>(
  arr: T[],
  priority: PriorityDraggableTableProps<T>['priority']
) {
  if (arr.length === 0) {
    return;
  }

  if (priority.get(arr[0]) !== 1) {
    throw new Error('First item does not have priority 1');
  }

  let lastPriority = 1;
  for (let i = 1; i < arr.length; i++) {
    const prio = priority.get(arr[i]);
    if (prio === lastPriority) {
      continue;
    }

    if (prio === lastPriority + 1) {
      lastPriority = prio;
      continue;
    }

    throw new Error(
      `bad priority at index ${i} in array: ${arr
        .map((e) => priority.get(e))
        .join(', ')} (lastPriority=${lastPriority}, prio=${prio})`
    );
  }

  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (Object.is(arr[i], arr[j])) {
        throw new Error(`Duplicate items at indices ${i} and ${j}`);
      }
    }
  }
}
