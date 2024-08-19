import { convertUsingKeymap } from '../../admin/crud/CrudFetcher';
import { CrudFetcherKeyMap } from '../../admin/crud/CrudFetcher';
import { CrudFetcherFilter, CrudFetcherSort } from '../../admin/crud/CrudFetcher';
import { apiFetch } from '../ApiConstants';
import { LoginContextValue } from '../contexts/LoginContext';
import { CancelablePromise } from './CancelablePromise';
import { Callbacks } from './Callbacks';
import { createCancelablePromiseFromCallbacks } from './createCancelablePromiseFromCallbacks';

/**
 * When just going through a list of items normally, the api will return
 * the CrudFetcherSort to use to simplify frontend logic. However, for
 * infinite listings we need a lot of control over fetching items, and
 * hence we must provide a function that can generate the sort for us.
 *
 * Remember: A sort consists of a list of fields, where each field has a
 * direction (e.g., ascending or descending) and a value (e.g., for a number
 * ascending sort with value 5, we are fetching items with a value greater than
 * 5). All this information is available in the item as a rule, and hence the
 * correct sort for the items immediately after/before a given item can be
 * generated.
 */
export type InfiniteListingSortMaker<T> = (item: T, dir: 'before' | 'after') => CrudFetcherSort;

/**
 * Provides the necessary functionality for a standard infinite listing from
 * a single filters/sort endpoint.
 *
 * The general idea behind an infinite scroll is simple:  As the user scrolls,
 * we want to load items that are about to become visible, and unload items that
 * are no longer visible.
 *
 * What can make this appear more complicated is that we don't want to load items
 * from the api one at a time, since that would be slow, and lead to the user
 * scrolling very slightly up/down causing a lot of api calls.
 *
 * Hence there are three lists which we need to consider: the underlying list of
 * items on the server (which might be modified while we're scrolling), the list
 * of items we have in memory (which will typically be larger than the number
 * of items visible on screen), and the list of items which are currently
 * visible on screen.
 *
 * We can only access the first list via "X items before Y" or "X items after Y".
 * When performing this operation, we might get any number of items up to our load
 * limit (including 0) due to list modifications, plus knowledge if of if, at the
 * time we fetched in that direction, there were more items in that direction.
 *
 * The second list is the primary one for memory management. We can think of it as
 * a preloaded version of the first list, but with limited functionality: you can
 * no longer go before/after arbitrary items, and only 1 item is returned at a time.
 * This actually consists of two main lists: the items before whats currently visible,
 * and the items after whats currently visible.
 *
 * The third list is always a slice of the second one, and is the one that will have
 * items quickly added/removed from it as the user scrolls. This is the only list
 * that's exposed by this class.
 */
export class NetworkedInfiniteListing<T extends object> {
  private cachedList: CachedServerList<T>;
  /**
   * The maximum length of items. If items is less than this length it can be
   * assumed that it contains the entire list.
   */
  readonly visibleLimit: number;

  /**
   * How many items are rotated in/out in a given direction at a time
   */
  readonly rotationLength: number;

  /**
   * The items that should be shown. This list is always replaced, never
   * modified, making it suitable as a hook dependency. Null until the first
   * load is complete, which is started via reset()
   */
  items: T[] | null;

  /**
   * Callbacks that are called when the items list changes. This is intended
   * to be used to trigger react state updates, as by default react won't
   * rerender if the list is changed
   */
  readonly itemsChanged: Callbacks<T[] | null>;

  /**
   * Callbacks that are called when the last item is removed an a new earlier
   * item is added. This is normally used for moving where the items are
   * positioned on screen.
   *
   * Called with the items that were inserted at the beginning, in the same
   * order they now appear in items.
   */
  readonly onShiftedEarlier: Callbacks<T[]>;

  /**
   * Callbacks that are called when the first item is removed an a new later
   * item is added. This is normally used for moving where the items are
   * positioned on screen
   *
   * Called with the items that were inserted at the end, in the same
   * order they now appear in items.
   */
  readonly onShiftedLater: Callbacks<T[]>;

  constructor(
    endpoint: string,
    loadLimit: number,
    visibleLimit: number,
    rotationLength: number,
    filter: CrudFetcherFilter,
    initialSort: CrudFetcherSort,
    sortMaker: InfiniteListingSortMaker<T>,
    keyMap: CrudFetcherKeyMap<T> | ((raw: any) => T) | ((raw: any) => Promise<T>),
    loginContextRaw: LoginContextValue
  ) {
    this.cachedList = new CachedServerList(
      new ServerList(endpoint, loadLimit, filter, initialSort, sortMaker, keyMap, loginContextRaw),
      Math.max(2 * visibleLimit, 2 * loadLimit),
      visibleLimit,
      rotationLength
    );
    this.visibleLimit = visibleLimit;
    this.rotationLength = rotationLength;
    this.itemsChanged = new Callbacks();
    this.onShiftedEarlier = new Callbacks();
    this.onShiftedLater = new Callbacks();
    this.items = null;
  }

  /**
   * True if the first visible item is the first item in the list
   * for all client-side purposes, i.e., we will not attempt to load
   * any earlier items
   */
  get definitelyNoneAbove(): boolean {
    return this.cachedList.definitelyNoneAbove;
  }

  /**
   * True if the last visible item is the last item in the list
   * for all client-side purposes, i.e., we will not attempt to load
   * any later items
   */
  get definitelyNoneBelow(): boolean {
    return this.cachedList.definitelyNoneBelow;
  }

  /**
   * Refreshes the list of items, starting back up at the top. This
   * should be the first thing called.
   */
  async reset(): Promise<void> {
    this.items = null;
    this.itemsChanged.call(this.items);
    this.items = (await this.cachedList.reset().promise).slice();
    this.itemsChanged.call(this.items);
  }

  /**
   * Should be called when an item near the top becomes visible. This may remove
   * the last item and add a new earlier item after a delay. Note that it's
   * usually better to trigger this before the first item becomes visible as
   * inserting items above the visible content is generally more sensitive than
   * inserting items below it, so you want to ensure the rotation actually occurs
   * before the first item becomes visible.
   */
  onFirstVisible(): void {
    const result = this.cachedList.tryPopAndUnshift();
    result.promise
      .then((earlierItems) => {
        if (earlierItems !== null && earlierItems.length > 0) {
          this.items = [...earlierItems, ...(this.items?.slice(0, -earlierItems.length) ?? [])];
          this.onShiftedEarlier.call(earlierItems);
          this.itemsChanged.call(this.items);
        }
      })
      .catch((e) => {
        if (e !== 'Locked') {
          throw e;
        }
      });
  }

  /**
   * Should be called when the last item becomes visible. This may remove
   * the first item and add a new later item after a delay.
   */
  onLastVisible(): void {
    const result = this.cachedList.tryShiftAndPush();
    result.promise
      .then((laterItems) => {
        if (laterItems !== null && laterItems.length > 0) {
          this.items = [...(this.items?.slice(laterItems.length) ?? []), ...laterItems];
          this.onShiftedLater.call(laterItems);
          this.itemsChanged.call(this.items);
        }
      })
      .catch((e) => {
        if (e !== 'Locked') {
          throw e;
        }
      });
  }

  /**
   * Replaces all instances of an item matching a given predicate with
   * a new item. This is intended to allow for updating items in the list
   * based on user action. Note this only updates our copies of the item,
   * and does not update the server.
   */
  replaceItem(isItem: (item: T) => boolean, newItem: T | ((oldItem: T) => T)): void {
    this.items =
      this.items?.map((item) =>
        isItem(item) ? (typeof newItem === 'function' ? newItem(item) : newItem) : item
      ) ?? null;
    this.cachedList.replaceItem(isItem, newItem);
    this.itemsChanged.call(this.items);
  }
}

/**
 * Provides the same interface as the networked infinite listing, but where there
 * really are an infinite number of items, and they can be generated just by their
 * index. This is primarily used for testing rendering, but could also be used
 * for a list that is generated procedurally.
 */
export class ProceduralInfiniteListing<T extends object> {
  /**
   * The generator used to create items from the index
   */
  private readonly generator: (index: number) => T;

  /**
   * If positive, we add this delay to all asynchronous operations
   * to simulate network latency
   */
  private readonly fakedNetworkDelay: number;

  /**
   * The index of the first item in the list
   */
  private firstIndex: number;

  /**
   * Only required if faking a network delay: true if we are currently
   * waiting for a timeout to complete
   */
  private locked: boolean;

  /**
   * The maximum number of items available, or undefined for infinitely
   * many.
   */
  private readonly maxItems: number | undefined;

  /**
   * The number of items in the list at a time.
   */
  readonly visibleLimit: number;

  /**
   * How many items are rotated in/out in a given direction at a time
   */
  readonly rotationLength: number;

  /**
   * The items that should be shown. This list is always replaced, never
   * modified, making it suitable as a hook dependency. Null until the first
   * call to reset()
   */
  items: T[] | null;
  /**
   * Callbacks that are called when the items list changes. This is intended
   * to be used to trigger react state updates, as by default react won't
   * rerender if the list is changed
   */
  readonly itemsChanged: Callbacks<T[] | null>;

  /**
   * Callbacks that are called when the last item is removed an a new earlier
   * item is added. This is normally used for moving where the items are
   * positioned on screen
   */
  readonly onShiftedEarlier: Callbacks<T[]>;

  /**
   * Callbacks that are called when the first item is removed an a new later
   * item is added. This is normally used for moving where the items are
   * positioned on screen
   */
  readonly onShiftedLater: Callbacks<T[]>;

  constructor(
    generator: (index: number) => T,
    visibleLimit: number,
    rotationLength: number = 1,
    fakedNetworkDelay: number = 0,
    maxItems: number | undefined = undefined
  ) {
    this.generator = generator;
    this.fakedNetworkDelay = fakedNetworkDelay;
    this.firstIndex = 0;
    this.locked = false;
    this.visibleLimit = visibleLimit;
    this.rotationLength = rotationLength;
    this.maxItems = maxItems;
    this.items = null;
    this.itemsChanged = new Callbacks();
    this.onShiftedEarlier = new Callbacks();
    this.onShiftedLater = new Callbacks();
  }

  /**
   * True if the first visible item is the first item in the list
   * for all client-side purposes, i.e., we will not attempt to load
   * any earlier items
   */
  get definitelyNoneAbove(): boolean {
    return this.firstIndex === 0;
  }

  /**
   * Always false, as we can always generate more items
   */
  get definitelyNoneBelow(): boolean {
    if (this.maxItems === undefined) {
      return false;
    }
    return this.firstIndex + this.visibleLimit >= this.maxItems;
  }

  /**
   * Initializes the items at index 0
   */
  async reset(): Promise<void> {
    if (this.fakedNetworkDelay > 0) {
      this.items = null;
      this.itemsChanged.call(this.items);
      await new Promise((resolve) => setTimeout(resolve, this.fakedNetworkDelay));
    }
    this.items = [];
    for (
      let i = 0;
      i < this.visibleLimit && (this.maxItems === undefined || i < this.maxItems);
      i++
    ) {
      this.items.push(this.generator(i));
    }
    this.itemsChanged.call(this.items);
  }

  /**
   * Should be called when the first item becomes visible. This may remove
   * the last item and add a new earlier item after a delay.
   */
  onFirstVisible(): void {
    (async () => {
      if (this.locked) {
        return;
      }

      if (this.firstIndex === 0) {
        return;
      }

      if (this.items === null) {
        return;
      }

      this.locked = true;
      if (this.fakedNetworkDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.fakedNetworkDelay));
      }

      const numItemsEarlier = Math.min(this.firstIndex, this.rotationLength);
      this.firstIndex -= numItemsEarlier;
      const newItems = [];
      for (let i = 0; i < numItemsEarlier; i++) {
        newItems.push(this.generator(this.firstIndex + i));
      }
      this.items = [...newItems, ...this.items.slice(0, this.items.length - numItemsEarlier)];
      this.locked = false;
      this.onShiftedEarlier.call(newItems);
      this.itemsChanged.call(this.items);
    })();
  }

  /**
   * Should be called when the last item becomes visible. This may remove
   * the first item and add a new later item after a delay.
   */
  onLastVisible(): void {
    (async () => {
      if (this.locked) {
        return;
      }

      if (this.items === null || this.definitelyNoneBelow) {
        return;
      }

      this.locked = true;
      if (this.fakedNetworkDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.fakedNetworkDelay));
      }

      let numItemsLater = this.rotationLength;
      if (this.maxItems !== undefined) {
        numItemsLater = Math.min(
          numItemsLater,
          this.maxItems - (this.firstIndex + this.items.length)
        );
      }
      const newItems = [];
      for (let i = 0; i < numItemsLater; i++) {
        newItems.push(this.generator(this.firstIndex + this.visibleLimit + i));
      }
      this.items = [...this.items.slice(numItemsLater), ...newItems];
      this.firstIndex += numItemsLater;
      this.locked = false;

      this.onShiftedLater.call(newItems);
      this.itemsChanged.call(this.items);
    })();
  }

  /**
   * Replaces all instances of an item matching a given predicate with
   * a new item. This is intended to allow for updating items in the list
   * based on user action. This will not persist if the item is unloaded
   * and reloaded.
   */
  replaceItem(isItem: (item: T) => boolean, newItem: T | ((oldItem: T) => T)): void {
    this.items =
      this.items?.map((item) =>
        isItem(item) ? (typeof newItem === 'function' ? newItem(item) : newItem) : item
      ) ?? null;
    this.itemsChanged.call(this.items);
  }
}

/**
 * Provides the same interface as the networked infinite listing, but with a
 * fixed set of prefixed objects, often of a different type than the underlying
 * data (for e.g., tooltips).
 */
export class PrefixedNetworkedInfiniteListing<DataT extends object, PrefixT extends object> {
  private delegate: InfiniteListing<DataT>;
  private prefix: PrefixT[];

  readonly visibleLimit: number;
  readonly rotationLength: number;

  readonly itemsChanged: Callbacks<(DataT | PrefixT)[] | null>;
  readonly onShiftedEarlier: Callbacks<(DataT | PrefixT)[]>;
  readonly onShiftedLater: Callbacks<(DataT | PrefixT)[]>;

  get items(): (DataT | PrefixT)[] | null {
    if (this.delegate.items === null) {
      return null;
    }

    if (this.delegate.definitelyNoneAbove) {
      return [...this.prefix, ...this.delegate.items];
    }

    return this.delegate.items;
  }

  constructor(delegate: InfiniteListing<DataT>, prefix: PrefixT[]) {
    this.delegate = delegate;
    this.prefix = prefix;

    this.visibleLimit = delegate.visibleLimit;
    this.rotationLength = delegate.rotationLength;

    this.itemsChanged = new Callbacks();
    this.onShiftedEarlier = new Callbacks();
    this.onShiftedLater = new Callbacks();

    this.delegate.itemsChanged.add(this.onDelegateItemsChanged.bind(this));
    this.delegate.onShiftedEarlier.add(this.onDelegateShiftedEarlier.bind(this));
    this.delegate.onShiftedLater.add(this.onDelegateShiftedLater.bind(this));
  }

  get definitelyNoneAbove(): boolean {
    return this.delegate.definitelyNoneAbove;
  }

  get definitelyNoneBelow(): boolean {
    return this.delegate.definitelyNoneBelow;
  }

  async reset(): Promise<void> {
    await this.delegate.reset();
  }

  onFirstVisible(): void {
    this.delegate.onFirstVisible();
  }

  onLastVisible(): void {
    this.delegate.onLastVisible();
  }

  replaceItem(
    isItem: (item: DataT) => boolean,
    newItem: DataT | ((oldItem: DataT) => DataT)
  ): void {
    this.delegate.replaceItem(isItem, newItem);
  }

  private onDelegateItemsChanged(items: DataT[] | null): void {
    this.itemsChanged.call(this.items);
  }

  private onDelegateShiftedEarlier(items: DataT[]): void {
    if (this.delegate.definitelyNoneAbove) {
      this.onShiftedEarlier.call([...this.prefix, ...items]);
    } else {
      this.onShiftedEarlier.call(items);
    }
  }

  private onDelegateShiftedLater(items: DataT[]): void {
    this.onShiftedLater.call(items);
  }
}

export type InfiniteListing<T extends object> =
  | NetworkedInfiniteListing<T>
  | ProceduralInfiniteListing<T>;

/**
 * A more limited interface into a ServerList. Like the ServerList, this only
 * allows fetching the first page or fetching items before/after an item. Unlike
 * ServerList, before/after an item is reduced to just before the first visible
 * item and after the last visible item, and only one item is returned at a
 * time. The initial page is kept essentially the same.
 *
 * This uses a locking strategy to ensure that only one operation is in flight
 * at a time for a given instance. Attempting to perform an operation while
 * the lock is held will immediately result in a rejected promise.
 */
class CachedServerList<T extends object> {
  private serverList: ServerList<T>;

  /**
   * When a rotation is requested, the number of items we attempt to
   * load before/after the first/last visible item.
   */
  private rotationLength: number;

  /**
   * In descending order, the items before the first visible item. Thus,
   * the item at index 0 is the first item before the first visible item.
   */
  private before: T[];
  private moreBefore: boolean;
  private visible: T[];
  /**
   * In ascending order, the items after the last visible item. Thus,
   * the item at index 0 is the first item after the last visible item.
   */
  private after: T[];
  private moreAfter: boolean;
  private preloadLimit: number;
  private pageSize: number;
  private locked: boolean;

  /**
   * If we are currently fetching items after the last visible item, this
   * will be the promise for that operation. Otherwise, it will be null.
   */
  private fetchingAfter: CancelablePromise<void> | null;

  /**
   * If we are currently fetching items before the first visible item, this
   * will be the promise for that operation. Otherwise, it will be null.
   */
  private fetchingBefore: CancelablePromise<void> | null;

  /**
   * Initializes an empty list. reset() should be called first to get the
   * first page; unshift and append will both fail if called before reset
   * under the assumption the list is empty.
   *
   * @param serverList The server list to use for fetching items
   * @param preloadLimit The maximum number of items that are preloaded in a
   *   given direction. This is a soft limit, and may be exceeded if it's set
   *   to a particularly egregious value (e.g., if the preloadLimit is below
   *   the limit set on the serverList, we won't discard the extra items returned).
   *   The recommended min value is
   *   `max(2*pageSize, 2*serverList.limit) + rotationLength` as this is
   *   guarranteed to be treated as a hard limit.
   * @param pageSize The number of items in the visible list at a time. Note
   *   that the visible list is not directly exposed in order to allow for
   *   future optimizations, however, its length is important for determining
   *   when to fetch more items. If there are at least pageSize items in the
   *   underlying list, and when loading the first page at least pageSize items
   *   are returned, the visible list will always have exactly pageSize items.
   * @param rotationLength The number of items to load before/after the first/last
   *   item when a rotation is requested.
   */
  constructor(
    serverList: ServerList<T>,
    preloadLimit: number,
    pageSize: number,
    rotationLength: number
  ) {
    this.serverList = serverList;
    this.rotationLength = rotationLength;
    this.before = [];
    this.moreBefore = false;
    this.visible = [];
    this.after = [];
    this.moreAfter = false;
    this.preloadLimit = preloadLimit;
    this.pageSize = pageSize;
    this.locked = false;
    this.fetchingAfter = null;
    this.fetchingBefore = null;
  }

  /**
   * True if the first visible item is the first item in the list
   * for all client-side purposes, i.e., we will not attempt to load
   * any earlier items
   */
  get definitelyNoneAbove(): boolean {
    return this.before.length === 0 && !this.moreBefore;
  }

  /**
   * True if the last visible item is the last item in the list
   * for all client-side purposes, i.e., we will not attempt to load
   * any later items
   */
  get definitelyNoneBelow(): boolean {
    return this.after.length === 0 && !this.moreAfter;
  }

  /**
   * Removes up to `rotationLength` from the end of the visible list and adds
   * the same number of items to the beginning of the visible list. In other
   * words, the change to the visible list is
   *
   * ```ts
   * const earlierItems = await cached.tryPopAndUnshift().promise;
   * if (earlierItems === null) {
   *   // no more earlier items
   * } else {
   *   visible = visible.slice(0, visible.length - earlierItems.length)
   *   visible.unshift(...earlierItems);
   * }
   * ```
   *
   * This will reject if the lock is held or if a network request is
   * required but fails.
   *
   * @returns A cancelable promise that resolves to the items to
   *   unshift.
   */
  tryPopAndUnshift(): CancelablePromise<T[] | null> {
    if (this.locked) {
      return {
        done: () => true,
        promise: Promise.reject('Locked'),
        cancel: () => {},
      };
    }

    if (this.visible.length === 0) {
      return {
        done: () => true,
        promise: Promise.resolve(null),
        cancel: () => {},
      };
    }

    // Standard case: we already have items ready to go
    if (this.before.length > 0) {
      const earlierItems = this.before.splice(0, this.rotationLength).reverse();
      const laterItems = this.visible.splice(
        this.visible.length - earlierItems.length,
        earlierItems.length
      );

      this.visible.unshift(...earlierItems);
      this.after.unshift(...laterItems);

      this._maybeUnloadAfter();
      this._maybeFetchBefore();
      return {
        done: () => true,
        promise: Promise.resolve(earlierItems),
        cancel: () => {},
      };
    }

    // Standard case: there is nothing before
    if (this.fetchingBefore === null && !this.moreBefore) {
      return {
        done: () => true,
        promise: Promise.resolve(null),
        cancel: () => {},
      };
    }

    // Fallback case: we reached the end of our preloaded list, so we need
    // to wait for the fetch to complete. Note that since we yield control,
    // we'll have to recheck everything when we get control back.
    this.locked = true;
    let active = true;
    const cancelers = new Callbacks<undefined>();
    const cancel = () => {
      if (active) {
        this.locked = false;
        active = false;
        cancelers.call(undefined);
      }
    };

    const promise = (async (): Promise<T[] | null> => {
      if (!active) {
        throw new Error('canceled');
      }

      this._maybeFetchBefore();
      if (this.before.length > 0) {
        cancel();
        const result = this.tryPopAndUnshift();
        if (!result.done()) {
          result.cancel();
          throw new Error(
            'Invariant violation: tryPopAndUnshift() returned !done() despite this.before.length > 0'
          );
        }
        return await result.promise;
      }

      const fetchBeforePromise = this.fetchingBefore;
      if (fetchBeforePromise === null) {
        return null;
      }

      const canceledPromise = createCancelablePromiseFromCallbacks(cancelers);
      try {
        await Promise.race([canceledPromise.promise, fetchBeforePromise.promise]);
      } catch (e) {
        canceledPromise.cancel();
        cancel();
        throw e;
      }
      if (!active) {
        throw new Error('Canceled');
      }
      if (!fetchBeforePromise.done()) {
        throw new Error(
          'Invariant violation: raced canceledPromise and fetchBeforePromise, neither was done'
        );
      }
      if (this.before.length === 0) {
        return null;
      }

      cancel();
      const result = this.tryPopAndUnshift();
      if (!result.done()) {
        throw new Error(
          'Invariant violation: tryPopAndUnshift() returned !done() despite this.before.length > 0'
        );
      }
      return await result.promise;
    })();

    return {
      done: () => !active,
      promise,
      cancel,
    };
  }

  /**
   * Removes up to `rotationLength` items from the beginning of the visible list
   * and adds an item to the end of the visible list. In other words, the change
   * to the visible list is
   *
   * ```ts
   * const laterItems = await cached.tryShiftAndPush().promise;
   * if (laterItems === null) {
   *  // no more later items
   * } else {
   *  visible = visible.slice(laterItems.length)
   *  visible.push(...laterItems);
   * }
   * ```
   *
   * This will reject if the lock is held or if a network request is
   * required but fails.
   *
   * @returns A cancelable promise that resolves to the items to
   *   push.
   */
  tryShiftAndPush(): CancelablePromise<T[] | null> {
    if (this.locked) {
      return {
        done: () => true,
        promise: Promise.reject('Locked'),
        cancel: () => {},
      };
    }

    if (this.visible.length === 0) {
      return {
        done: () => true,
        promise: Promise.resolve(null),
        cancel: () => {},
      };
    }

    // Standard case: we already have items ready to go
    if (this.after.length > 0) {
      const laterItems = this.after.splice(0, this.rotationLength);
      const earlierItems = this.visible.splice(0, laterItems.length);

      this.visible.push(...laterItems);
      this.before.unshift(...earlierItems.reverse());
      this._maybeUnloadBefore();
      this._maybeFetchAfter();
      return {
        done: () => true,
        promise: Promise.resolve(laterItems),
        cancel: () => {},
      };
    }

    // Standard case: there is nothing after
    if (this.fetchingAfter === null && !this.moreAfter) {
      return {
        done: () => true,
        promise: Promise.resolve(null),
        cancel: () => {},
      };
    }

    // Fallback case: we reached the end of our preloaded list, so we need
    // to wait for the fetch to complete. Note that since we yield control,
    // we'll have to recheck everything when we get control back.
    this.locked = true;
    let active = true;
    const cancelers = new Callbacks<undefined>();
    const cancel = () => {
      if (active) {
        this.locked = false;
        active = false;
        cancelers.call(undefined);
      }
    };

    const promise = (async (): Promise<T[] | null> => {
      if (!active) {
        throw new Error('canceled');
      }

      this._maybeFetchAfter();
      if (this.after.length > 0) {
        cancel();
        const result = this.tryShiftAndPush();
        if (!result.done()) {
          result.cancel();
          throw new Error(
            'Invariant violation: tryShiftAndPush() returned !done() despite this.after.length > 0'
          );
        }
        return await result.promise;
      }

      const fetchAfterPromise = this.fetchingAfter;
      if (fetchAfterPromise === null) {
        return null;
      }

      const canceledPromise = createCancelablePromiseFromCallbacks(cancelers);
      try {
        await Promise.race([canceledPromise.promise, fetchAfterPromise.promise]);
      } catch (e) {
        canceledPromise.cancel();
        cancel();
        throw e;
      }
      if (!active) {
        throw new Error('Canceled');
      }
      if (!fetchAfterPromise.done()) {
        throw new Error(
          'Invariant violation: raced canceledPromise and fetchAfterPromise, neither was done'
        );
      }
      if (this.after.length === 0) {
        return null;
      }

      cancel();
      const result = this.tryShiftAndPush();
      if (!result.done()) {
        throw new Error(
          'Invariant violation: tryShiftAndPush() returned !done() despite this.after.length > 0'
        );
      }
      return await result.promise;
    })();

    return {
      done: () => !active,
      promise,
      cancel,
    };
  }

  /**
   * Resets the list to the first page. This will reject if the lock is held
   * or if a network request is required but fails.
   *
   * This should be called before any other operation on this list.
   *
   * @returns A cancelable promise that resolves to the new visible list.
   */
  reset(): CancelablePromise<T[]> {
    if (this.fetchingAfter !== null) {
      this.fetchingAfter.cancel();
    }
    if (this.fetchingBefore !== null) {
      this.fetchingBefore.cancel();
    }

    if (this.locked) {
      return {
        promise: Promise.reject(new Error('Cannot reset while locked')),
        cancel: () => {},
        done: () => true,
      };
    }

    this.locked = true;
    let active = true;
    const cancelers = new Callbacks<undefined>();
    const cancel = () => {
      if (active) {
        active = false;
        this.locked = false;
        cancelers.call(undefined);
      }
    };

    const promise: Promise<T[]> = (async () => {
      this.before = [];
      this.moreBefore = false;
      this.visible = [];
      this.after = [];
      this.moreAfter = false;

      try {
        const firstPage = this.serverList.loadFirstPage();
        cancelers.add(firstPage.cancel);
        const response = await firstPage.promise;
        cancelers.remove(firstPage.cancel);
        if (!active) {
          throw new Error('Canceled');
        }

        this.visible = response.items.slice(0, this.pageSize);
        this.after = response.items.slice(this.pageSize);
        this.moreAfter = response.haveMore;

        while (this.moreAfter && this.visible.length < this.pageSize) {
          const nextPage = this.serverList.loadAfter(this.visible[this.visible.length - 1]);
          cancelers.add(nextPage.cancel);
          const response = await nextPage.promise;
          cancelers.remove(nextPage.cancel);
          if (!active) {
            throw new Error('Canceled');
          }

          const numForVisible = Math.min(
            this.pageSize - this.visible.length,
            response.items.length
          );
          this.visible.push(...response.items.slice(0, numForVisible));
          this.after.push(...response.items.slice(numForVisible));
          this.moreAfter = response.haveMore;
        }

        active = false;
        this.locked = false;
        return this.visible;
      } catch (e) {
        if (!active) {
          throw new Error('Canceled');
        }

        active = false;
        this.locked = false;
        throw e;
      }
    })();

    return {
      promise,
      done: () => !active,
      cancel,
    };
  }

  /**
   * Replaces any in-memory instances matching the given filter with the given item
   *
   * @param isItem The predicate to find the old item
   * @param newItem The new item to replace the old item with
   */
  replaceItem(isItem: (item: T) => boolean, newItem: T | ((oldItem: T) => T)): void {
    for (let arr of [this.before, this.visible, this.after]) {
      for (let i = 0; i < arr.length; i++) {
        if (isItem(arr[i])) {
          arr[i] = typeof newItem === 'function' ? newItem(arr[i]) : newItem;
        }
      }
    }
  }

  /**
   * If we don't have enough items before, fetch more.
   */
  private _maybeFetchBefore() {
    if (this.fetchingBefore !== null) {
      return;
    }

    if (!this.moreBefore) {
      return;
    }

    if (this.before.length >= this.pageSize) {
      return;
    }

    if (this.visible.length === 0) {
      return;
    }

    let active = true;
    const cancelers = new Callbacks<undefined>();
    const cancel = () => {
      if (active) {
        this.fetchingBefore = null;
        active = false;
        cancelers.call(undefined);
      }
    };
    const promise = (async (): Promise<void> => {
      if (!active) {
        throw new Error('Canceled');
      }

      const fetchBefore = this.serverList.loadBefore(
        this.before[this.before.length - 1] ?? this.visible[0]
      );
      cancelers.add(fetchBefore.cancel);

      const canceledPromise = createCancelablePromiseFromCallbacks(cancelers);
      try {
        await Promise.race([canceledPromise.promise, fetchBefore.promise]);
      } catch (e) {
        cancel();
        throw e;
      }
      if (!active) {
        throw new Error('Canceled');
      }
      if (!fetchBefore.done()) {
        throw new Error(
          'Invariant violation: raced canceledPromise and fetchBefore, neither was done'
        );
      }
      canceledPromise.cancel();
      cancelers.remove(fetchBefore.cancel);

      const result = await fetchBefore.promise;
      if (!active) {
        throw new Error('Canceled');
      }

      this.before.push(...result.items);
      this.moreBefore = result.haveMore;
    })();

    promise.finally(() => {
      cancel();
    });

    this.fetchingBefore = {
      done: () => !active,
      promise,
      cancel,
    };
  }

  /**
   * If we don't have enough items after, fetch more.
   */
  private _maybeFetchAfter() {
    if (this.fetchingAfter !== null) {
      return;
    }

    if (!this.moreAfter) {
      return;
    }

    if (this.after.length >= this.pageSize) {
      return;
    }

    if (this.visible.length === 0) {
      return;
    }

    let active = true;
    const cancelers = new Callbacks<undefined>();
    const cancel = () => {
      if (active) {
        this.fetchingAfter = null;
        active = false;
        cancelers.call(undefined);
      }
    };
    const promise = (async (): Promise<void> => {
      if (!active) {
        throw new Error('Canceled');
      }

      const fetchAfter = this.serverList.loadAfter(
        this.after[this.after.length - 1] ?? this.visible[this.visible.length - 1]
      );
      cancelers.add(fetchAfter.cancel);

      const canceledPromise = createCancelablePromiseFromCallbacks(cancelers);
      try {
        await Promise.race([canceledPromise.promise, fetchAfter.promise]);
      } catch (e) {
        cancel();
        throw e;
      }
      if (!active) {
        throw new Error('Canceled');
      }
      if (!fetchAfter.done()) {
        throw new Error(
          'Invariant violation: raced canceledPromise and fetchAfter, neither was done.'
        );
      }
      canceledPromise.cancel();
      cancelers.remove(fetchAfter.cancel);

      const result = await fetchAfter.promise;
      if (!active) {
        throw new Error('Canceled');
      }

      this.after.push(...result.items);
      this.moreAfter = result.haveMore;
    })();

    promise.finally(() => {
      cancel();
    });

    this.fetchingAfter = {
      done: () => !active,
      promise,
      cancel,
    };
  }

  /**
   * If we have too many items before, unload some.
   */
  private _maybeUnloadBefore() {
    if (this.before.length <= this.preloadLimit) {
      return;
    }

    if (this.fetchingBefore !== null) {
      return;
    }

    this.before = this.before.slice(0, this.preloadLimit);
  }

  /**
   * If we have too many items after, unload some.
   */
  private _maybeUnloadAfter() {
    if (this.after.length <= this.preloadLimit) {
      return;
    }

    if (this.fetchingAfter !== null) {
      return;
    }

    this.after = this.after.slice(0, this.preloadLimit);
  }
}

type ServerListResponse<T> = {
  items: T[];
  /**
   * True if there are more items in this direction, false if there are not.
   * For the first page, this is ascending index order. For before/after, this
   * is descending/ascending index order, respectively.
   */
  haveMore: boolean;
};

/**
 * The list-like representation of the values that are on the server. This list
 * has only three operations: fetch the first N items, fetch N items before an
 * item, and fetch N items after an item.
 *
 * Note that these all return 0-N items (inclusive), and a hint for whether there
 * are more items "in that direction", where initially the direction is "after"
 * (since there's nothing before the first item). This is deterministic, but it's
 * still only a hint since the underlying list can be modified at any time. If it
 * isn't modified, then the hint is guaranteed to be correct.
 */
class ServerList<T> {
  /**
   * The search endpoint to fetch from, e.g., /api/1/users/search
   */
  private readonly endpoint: string;
  /**
   * The maximum number of items to fetch at a time. This is a hard limit,
   * but receiving fewer than this number may happen despite there being
   * more items in that direction.
   */
  private readonly limit: number;
  /**
   * The filter on the underlying items. Changing the filter doesn't make
   * sense without resetting the entire list.
   */
  private readonly filter: CrudFetcherFilter;
  /**
   * The sort for the first page of items. This is necessarily coupled to the
   * sortMaker, since the sortMaker is used to generate the sort for the next
   * page of items.
   */
  private readonly initialSort: CrudFetcherSort;
  /**
   * The function that generates the sort to continue in a given direction
   * from a given item.
   */
  private readonly sortMaker: InfiniteListingSortMaker<T>;
  /**
   * The function or standard key map for converting raw items from the server
   * into the items we want to store in memory.
   */
  private readonly keyMap: CrudFetcherKeyMap<T> | ((raw: any) => T) | ((raw: any) => Promise<T>);

  /**
   * The value provided from useContext(LoginContext), which never updates,
   * hence is not an issue to use as a dependency.
   */
  private readonly loginContextRaw: LoginContextValue;

  constructor(
    endpoint: string,
    limit: number,
    filter: CrudFetcherFilter,
    initialSort: CrudFetcherSort,
    sortMaker: InfiniteListingSortMaker<T>,
    keyMap: CrudFetcherKeyMap<T> | ((raw: any) => T) | ((raw: any) => Promise<T>),
    loginContextRaw: LoginContextValue
  ) {
    this.endpoint = endpoint;
    this.limit = limit;
    this.filter = filter;
    this.initialSort = initialSort;
    this.sortMaker = sortMaker;
    this.keyMap = keyMap;
    this.loginContextRaw = loginContextRaw;
  }

  private loadWithSort(sort: CrudFetcherSort): CancelablePromise<ServerListResponse<T>> {
    let active = true;
    const abortController: AbortController | null = window.AbortController
      ? new window.AbortController()
      : null;
    const signal = abortController?.signal;
    const cancel = () => {
      if (active) {
        active = false;
        if (abortController) {
          abortController.abort();
        }
      }
    };

    const promise = (async (): Promise<ServerListResponse<T>> => {
      if (!active) {
        active = false;
        throw new Error('Promise cancelled');
      }

      const loginContext = this.loginContextRaw.value.get();
      if (loginContext.state === 'loading') {
        active = false;
        throw new Error('LoginContext still loading');
      }

      const response = await apiFetch(
        this.endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            filters: this.filter,
            sort,
            limit: this.limit,
          }),
          ...(signal === undefined ? {} : { signal }),
        },
        loginContext.state === 'logged-in' ? loginContext : null
      );
      if (!active) {
        active = false;
        throw new Error('Promise cancelled');
      }
      if (!response.ok) {
        active = false;
        throw response;
      }
      const data: { items: any[]; next_page_sort?: CrudFetcherSort | null } = await response.json();
      if (!active) {
        active = false;
        throw new Error('Promise cancelled');
      }
      const keyMap = this.keyMap;
      const items =
        typeof keyMap === 'function'
          ? await Promise.all(
              data.items.map((i) => (keyMap as any).call(undefined, i) as unknown as Promise<T>)
            )
          : data.items.map((i) => convertUsingKeymap(i, keyMap));

      const haveMore =
        data.next_page_sort !== undefined &&
        data.next_page_sort !== null &&
        data.next_page_sort.some((s) => s.after !== null && s.after !== undefined);
      active = false;
      return {
        items,
        haveMore,
      };
    })();

    return {
      promise,
      done: () => !active,
      cancel,
    };
  }

  /**
   * Loads the first N items, in ascending order (i.e., first item is index 0,
   * last item is index N-1)
   *
   * @returns A cancelable promise for the first page of items.
   */
  loadFirstPage(): CancelablePromise<ServerListResponse<T>> {
    return this.loadWithSort(this.initialSort);
  }

  /**
   * Loads N items before the given item, in descending order. That is to say,
   * if the given item is index M, then the returned list as item M-1 at index
   * 0, item M-2 at index 1, and so on. Hence, typically the following technique
   * would be used to update the list:
   *
   * ```ts
   * const items = [5,6,7,8]
   * const newItems = [4,3,2,1];
   * const newItemsWithOldItems = [...newItems.reverse(), ...items];
   * ```
   *
   * @param item The item to load before.
   * @returns A cancelable promise for the items before the given item
   */
  loadBefore(item: T): CancelablePromise<ServerListResponse<T>> {
    return this.loadWithSort(this.sortMaker.call(undefined, item, 'before'));
  }

  /**
   * Loads N items after the given item, in ascending order. That is to say,
   * if the given item is index M, then the returned list as item M+1 at index
   * 0, item M+2 at index 1, and so on. Hence, typically the following technique
   * would be used to update the list:
   *
   * ```ts
   * const items = [5,6,7,8]
   * const newItems = [9,10,11,12];
   * const newItemsWithOldItems = [...items, ...newItems];
   * ```
   *
   * @param item The item to load after.
   * @returns A cancelable promise for the items after the given item
   */
  loadAfter(item: T): CancelablePromise<ServerListResponse<T>> {
    return this.loadWithSort(this.sortMaker.call(undefined, item, 'after'));
  }
}
