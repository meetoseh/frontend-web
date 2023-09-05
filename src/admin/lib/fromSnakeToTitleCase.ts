/*
 * Convenience function to convert from snake_case to Title Case
 */
export const fromSnakeToTitleCase = (snake: string): string => {
  return snake
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
};
