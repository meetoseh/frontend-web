import { compareVectorSizes } from './compareSizes';

describe('compareVectorSizes', () => {
  test('first better', () => {
    expect(
      compareVectorSizes(
        { width: 500, height: 250 },
        { width: 30, height: 15 },
        { width: 30, height: 30 }
      )
    ).toBeLessThan(0);
  });
  test('first better, inexact', () => {
    expect(
      compareVectorSizes(
        { width: 500, height: 250 },
        { width: 100, height: 80 },
        { width: 100, height: 90 }
      )
    ).toBeLessThan(0);
  });
  test('second better', () => {
    expect(
      compareVectorSizes(
        { width: 500, height: 250 },
        { width: 30, height: 30 },
        { width: 30, height: 15 }
      )
    ).toBeGreaterThan(0);
  });
  test('second better, inexact', () => {
    expect(
      compareVectorSizes(
        { width: 500, height: 250 },
        { width: 100, height: 90 },
        { width: 100, height: 80 }
      )
    ).toBeGreaterThan(0);
  });
  test('equal', () => {
    expect(
      compareVectorSizes(
        { width: 500, height: 250 },
        { width: 60, height: 30 },
        { width: 30, height: 15 }
      )
    ).toBe(0);
  });
  test('equal, inexact', () => {
    expect(
      compareVectorSizes(
        { width: 500, height: 500 },
        { width: 90, height: 60 },
        { width: 60, height: 90 }
      )
    ).toBe(0);
  });
  test('reduction', () => {
    expect(
      compareVectorSizes(
        { width: 50_000, height: 50_000 },
        { width: 90_000, height: 60_000 },
        { width: 60_000, height: 90_000 }
      )
    ).toBe(0);
  });
});
