// https://github.com/whatgoodisaroad/bezier-js
/*
The MIT License (MIT)

Copyright (c) 2014 Wyatt Allen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Modified 01/09/2023 Timothy Moore:
// - convert to typescript
// - removed mutation functions (setPoints etc)
// - added more documentation
// - added constants for css named curves

// Modified 02/20/2023 Timothy Moore:
// - fixed a few additional lint errors related to let/var

// Modified 04/04/2023 Timothy Moore:
// - added easeInBack, easeOutBack, easeInOutBack

// General Bézier Curve, any number of dimensions or control points
//
// All math from http://en.wikipedia.org/wiki/B%C3%A9zier_curve#Generalization
//
// The approximate function inspired by
// http://www.flong.com/texts/code/shapers_bez/
//
// Create a bezier function with a list of points. Each point must me a vector
// of its coordinates. All such vectors should have the same cardinality.
//
// e.g new Bezier([ [0, 0], [0.75, 0.25], [1, 1] ])
//
// github.com/whatgoodisaroad/bezier-js
//
export class Bezier {
  /**
   * Control points
   */
  private points: number[][];

  /**
   * Order is the number of points.
   * e.g. order = 2 ==> Linear
   *            = 3 ==> Quadratic
   *            = 4 ==> Cubic
   *            = 5 ==> Quartic
   *            = 6 ==> Quintic
   *              etc...
   */
  private order: number;

  /**
   * Cardinality is the number of dimensions for the point vectors.
   */
  private cardinality: number;

  /**
   * Number of refinement iterations for the approximator. Larger
   * numbers ==> greater precision. Appropriate  values depend somewhat on
   * how extreme the slope of your curve gets, how much precision you need
   * and how much speed you need. Larger values slow things down
   * significantly.
   */
  private refinement: number;

  constructor(points: number[][], refinement = 10) {
    this.points = points;
    this.order = points.length;
    this.cardinality = points[0].length;
    this.refinement = refinement;
  }

  /**
   * Compute the curve value as a vector for some t
   * @param t the parameter
   * @returns the blended vector
   */
  b_t(t: number): number[] {
    const n = this.order - 1;
    let b = new_vec(this.cardinality);

    for (let i = 0; i <= n; ++i) {
      b = vec_add(b, sca_mul(b_i_n_t(i, n, t), this.points[i]));
    }

    return b;
  }

  /**
   * Compute the curve differential as a vector for some t.
   * i.e. [ dx_1, dx_2, ..., dx_n ]
   * @param t the parameter
   * @returns the curve differential
   */
  differential_t(t: number): number[] {
    const n = this.order - 1;
    let g = new_vec(this.cardinality);

    for (let i = 0; i <= n - 1; ++i) {
      g = vec_add(g, sca_mul(b_i_n_t(i, n - 1, t), vec_sub(this.points[i + 1], this.points[i])));
    }

    return sca_mul(n, g);
  }

  /**
   * Compute the derivative for two variables for some t.
   * For example, in 2 dimensions, if we have x_1 is x and x_2 is y, then
   * dy/dx at t is my_beezier.derivative_t(0, 1, t)
   *
   * More simply, it just computes the ratio of components of the
   * differential vector. Errors where slope is infinite.
   */
  derivative_t(ix: number, iy: number, t: number) {
    const g = this.differential_t(t);

    if (g[ix] === 0) {
      return 0;
    } else {
      return g[iy] / g[ix];
    }
  }

  /**
   * Approximate the bezier as a function assuming that the cardinality is 2.
   *
   * For example, if the Bezier is meant to approximate y = f(x), where x_1 is
   * x and x_2 is y, then y = f(x) ~~ my_bezier.approximate(0, 1, x)
   * @return the approximate coordinate
   */
  approximate(ix: number, iy: number, x0: number): number {
    let t = x0;
    let x1, dydx;

    for (let i = 0; i < this.refinement; ++i) {
      x1 = this.b_t(t)[ix];

      if (x0 === x1) {
        break;
      }

      dydx = this.derivative_t(ix, iy, t);

      t -= (x1 - x0) * dydx;
      t = Math.max(0, Math.min(1, t));
    }

    return this.b_t(t)[iy];
  }

  /**
   * A shorthand for 2-dimensional curves. Fetches the y value for some x.
   * @param x0 the x value
   * @returns the y value
   */
  y_x(x0: number): number {
    return this.approximate(0, 1, x0);
  }

  /**
   * A shorthand for 2-dimensional curves. Fetches the x value for some y.
   * @param y0 the y value
   * @returns the x value
   */
  x_y(y0: number): number {
    return this.approximate(1, 0, y0);
  }
}

/**
 * The standard ease bezier function in css
 */
export const ease = new Bezier([
  [0, 0],
  [0.25, 0.1],
  [0.25, 1.0],
  [1, 1],
]);

/**
 * The standard ease-in bezier function in css
 */
export const easeIn = new Bezier([
  [0, 0],
  [0.42, 0.0],
  [1.0, 1.0],
  [1, 1],
]);

/**
 * The standard ease-in-out bezier function in css
 */
export const easeInOut = new Bezier([
  [0, 0],
  [0.42, 0.0],
  [0.58, 1.0],
  [1, 1],
]);

/**
 * https://easings.net/#easeInBack
 */
export const easeInBack = new Bezier([
  [0, 0],
  [0.36, 0],
  [0.66, -0.56],
  [1, 1],
]);

/**
 * https://easings.net/#easeOutBack
 */
export const easeOutBack = new Bezier([
  [0, 0],
  [0.34, 1.56],
  [0.64, 1],
  [1, 1],
]);

/**
 * https://easings.net/#easeInOutBack
 */
export const easeInOutBack = new Bezier([
  [0, 0],
  [0.68, -0.6],
  [0.32, 1.6],
  [1, 1],
]);

/**
 * The standard ease-out bezier function in css
 */
export const easeOut = new Bezier([
  [0, 0],
  [0.0, 0.0],
  [0.58, 1.0],
  [1, 1],
]);

// sundry helpers
function fact(n: number): number {
  return n <= 1 ? 1 : n * fact(n - 1);
}
function binom(n: number, k: number): number {
  return fact(n) / (fact(k) * fact(n - k));
}
function sca_mul(s: number, v: number[]): number[] {
  return v.map(function (e) {
    return e * s;
  });
}
function vec_add(u: number[], v: number[]): number[] {
  return u.map(function (e, i) {
    return e + v[i];
  });
}
function vec_sub(u: number[], v: number[]): number[] {
  return u.map(function (e, i) {
    return e - v[i];
  });
}
function new_vec(cardinality: number): number[] {
  const v = [];
  for (let i = 0; i < cardinality; ++i) {
    v.push(0);
  }
  return v;
}

/**
 * Compute a single Bezier polynomial term.
 *
 * B(t) = sum_(i=0, n) ( n choose i ) * t^i * (1-t)^(n-i) * P_i, where
 * P_i is the ith control point. This computes the term without the P_i.
 *
 * @param i Iteration index
 * @param n Order of the Bezier
 * @param t Parameter
 * @returns the polynomial term
 */
function b_i_n_t(i: number, n: number, t: number): number {
  return binom(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i);
}
