import { heappush as unboundHeappush, heappop as unboundHeappop } from './Heap';

type HeapItem = { v: number };
const heappush = unboundHeappush.bind(null, 'v');
const heappop = unboundHeappop.bind(null, 'v');

type HeapItemOperation = { op: 'push' | 'pop'; v: number };

describe('Heap', () => {
  test('add/remove in order', () => {
    const heap: HeapItem[] = [];
    heappush(heap, { v: 1 });
    heappush(heap, { v: 2 });
    heappush(heap, { v: 3 });
    heappush(heap, { v: 4 });
    heappush(heap, { v: 5 });
    expect(heappop(heap).v).toBe(1);
    expect(heappop(heap).v).toBe(2);
    expect(heappop(heap).v).toBe(3);
    expect(heappop(heap).v).toBe(4);
    expect(heappop(heap).v).toBe(5);
  });
  test('add/remove reverse order', () => {
    const heap: HeapItem[] = [];
    heappush(heap, { v: 5 });
    heappush(heap, { v: 4 });
    heappush(heap, { v: 3 });
    heappush(heap, { v: 2 });
    heappush(heap, { v: 1 });
    expect(heappop(heap).v).toBe(1);
    expect(heappop(heap).v).toBe(2);
    expect(heappop(heap).v).toBe(3);
    expect(heappop(heap).v).toBe(4);
    expect(heappop(heap).v).toBe(5);
  });
  test('add/remove random order', () => {
    const heap: HeapItem[] = [];
    const expected: number[] = [];
    const ops: HeapItemOperation[] = [];

    for (let i = 0; i < 1000; i++) {
      if (expected.length > 0 && Math.random() < 0.33) {
        const val = expected.shift()!;
        ops.push({ op: 'pop', v: val });
        const got = heappop(heap);
        expect(got).not.toBeNull();
        expect(got!.v).toBe(val);
        continue;
      } else {
        const val = Math.floor(Math.random() * 1000);
        ops.push({ op: 'push', v: val });
        heappush(heap, { v: val });
        expected.push(val);
        expected.sort((a, b) => a - b);
      }
    }
  });
});
