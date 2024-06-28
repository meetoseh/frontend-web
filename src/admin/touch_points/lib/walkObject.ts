export const walkObject = (
  obj: any,
  callback: (path: (string | number)[], data: any) => void,
  opts?: {
    prefix: (string | number)[];
  }
) => {
  const prefix = opts?.prefix ?? [];

  if (Array.isArray(obj)) {
    obj.forEach((value, index) => {
      const path = [...prefix, index];
      callback(path, value);
      if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        walkObject(value, callback, { prefix: path });
      }
    });
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    const path = [...prefix, key];
    callback(path, value);
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      walkObject(value, callback, { prefix: path });
    }
  }
};
