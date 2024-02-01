/**
 * Recursively iterate over all property paths of an object and apply the function.
 *
 * Example: { a: { b: 1 }, c: 'foo' } => ['a', 'b'], ['c']
 *
 * @param obj Object to iterate over
 * @param fn Function to apply for each property path
 * @param path Path to the current value: Must be empty when calling this function externally and is used internally for recursion
 */

export function iterateObjectPaths(obj, fn, path = []) {
  for (const key in obj) {
    const value = obj[key];
    const currentPath = [...path, key];

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      iterateObjectPaths(value, fn, currentPath);
    } else {
      fn(currentPath);
    }
  }
}
