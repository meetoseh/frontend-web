/**
 * Converts the given rgb or rgba string to a css color string.
 * @param parts
 * @returns
 */
export const rgbaToCss = (
  parts: [number, number, number] | [number, number, number, number]
): string => {
  const [r, g, b, a] = parts;
  return a === undefined
    ? `rgb(${r * 100}%, ${g * 100}%, ${b * 100}%)`
    : `rgba(${r * 100}%, ${g * 100}%, ${b * 100}%, ${a})`;
};
