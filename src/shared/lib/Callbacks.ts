/**
 * An abstraction for a list of functions to call when an event occurs,
 * with add/remove methods to add and remove functions from the list.
 *
 * This uses a doubly-linked list and a map to allow for O(1) add/remove
 * and O(n) iteration.
 */
export class Callbacks<T> {
  /**
   * The head of the linked list of callbacks, or null if the list is empty
   */
  private head: CallbackNode<T> | null;

  /**
   * The tail of the linked list of callbacks, or null if the list is empty
   */
  private tail: CallbackNode<T> | null;

  /**
   * The map from callbacks to nodes in the linked list, to allow for
   * O(1) remove
   */
  private lookup: Map<(event: T) => void, CallbackNode<T>>;

  /**
   * Initializes an empty list of callbacks
   */
  constructor() {
    this.head = null;
    this.tail = null;
    this.lookup = new Map();
  }

  /**
   * Adds the given callback to the list
   * @param callback the callback to add
   * @returns true if the callback was added, false if it was already in the list
   */
  add(callback: (event: T) => void): boolean {
    if (this.lookup.has(callback)) {
      return false;
    }

    const node = {
      callback,
      next: null,
      prev: this.tail,
    };

    if (this.tail) {
      this.tail.next = node;
    } else {
      this.head = node;
    }

    this.tail = node;
    this.lookup.set(callback, node);
    return true;
  }

  /**
   * Removes the given callback from the list, if it is in the list
   * @param callback the callback to remove
   * @returns true if the callback was removed, false if it was not in the list
   */
  remove(callback: (event: T) => void): boolean {
    const node = this.lookup.get(callback);
    if (node === undefined) {
      return false;
    }

    /* Case 1: node is the only node in the list */
    if (node.prev === null && node.next === null) {
      this.head = null;
      this.tail = null;
      this.lookup.delete(callback);
      return true;
    }

    /* Case 2: node is the head */
    if (node.prev === null) {
      if (this.head !== node || this.head.next === null) {
        throw new Error('Invariant violation');
      }

      this.head = this.head.next;
      this.head.prev = null;
      this.lookup.delete(callback);
      return true;
    }

    /* Case 3: node is the tail */
    if (node.next === null) {
      if (this.tail !== node || this.tail.prev === null) {
        throw new Error('Invariant violation');
      }

      this.tail = this.tail.prev;
      this.tail.next = null;
      this.lookup.delete(callback);
      return true;
    }

    /* Case 4: node is in the middle */
    const prev = node.prev;
    const nxt = node.next;

    prev.next = nxt;
    nxt.prev = prev;
    this.lookup.delete(callback);
    return true;
  }

  /**
   * Calls each callback in the list with the given event. If
   * callbacks are modified during the iteration, the modifications
   * will not be reflected in the iteration.
   * @param event the event to pass to each callback
   */
  call(event: T): void {
    const toCall = [];
    let node = this.head;
    while (node !== null) {
      toCall.push(node.callback);
      node = node.next;
    }

    for (const callback of toCall) {
      callback(event);
    }
  }

  /**
   * Removes all callbacks from the list
   */
  clear(): void {
    this.head = null;
    this.tail = null;
    this.lookup.clear();
  }
}

type CallbackNode<T> = {
  callback: (event: T) => void;
  next: CallbackNode<T> | null;
  prev: CallbackNode<T> | null;
};
