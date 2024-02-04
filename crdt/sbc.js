const UNTERMINATED = 0;
const TERMINATED = 1;
const ERRORED = 2;

const createCacheRoot = () => new WeakMap();
const createCacheNode = () => ({
  s: UNTERMINATED, // status
  v: void 0, // value
  o: null, // [object key WeakMap]
  p: null, // [primitive key Map ]
});

export function cache(fn) {
  return function (...args) {
    const fnMap = createCacheRoot();
    const fnNode = fnMap.get(fn);

    let cacheNode;
    if (fnNode === void 0) {
      cacheNode = createCacheNode();
      fnMap.set(fn, cacheNode);
    } else {
      cacheNode = fnNode;
    }

    for (const arg of args) {
      if (
        typeof arg === "function" ||
        (typeof arg === "object" && arg !== null)
      ) {
        let objectCache = cacheNode.o;
        if (objectCache === null) {
          cacheNode.o = objectCache = new WeakMap();
        }

        const objectNode = objectCache.get(arg);
        if (objectNode === void 0) {
          cacheNode = createCacheNode();
          objectCache.set(arg, cacheNode);
        } else {
          cacheNode = objectNode;
        }
      } else {
        let primitiveCache = cacheNode.p;
        if (primitiveCache === null) {
          cacheNode.p = primitiveCache = new Map();
        }

        const primitiveNode = primitiveCache.get(arg);
        if (primitiveNode === void 0) {
          cacheNode = createCacheNode();
          primitiveCache.set(arg, cacheNode);
        } else {
          cacheNode = primitiveNode;
        }
      }
    }

    if (cacheNode.s === TERMINATED) {
      return cacheNode.v;
    }

    if (cacheNode.s === ERRORED) {
      throw cacheNode.v;
    }

    try {
      const result = fn.apply(null, args);
      const terminatedNode = cacheNode;
      terminatedNode.s = TERMINATED;
      terminatedNode.v = result;
      return result;
    } catch (error) {
      const erroredNode = cacheNode;
      erroredNode.s = ERRORED;
      erroredNode.v = error;
      throw error;
    }
  };
}
