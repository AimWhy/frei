const RAW = "_raw_";
const isObject = (value) => typeof value === "object" && value !== null;
const hasChanged = (oldValue, newValue) => !Object.is(oldValue, newValue);

const arrayInstrumentations = Reflect.ownKeys(Array.prototype).reduce(
  (acc, key) => {
    const originFn = Array.prototype[key];

    if (typeof originFn !== "function") {
      return acc;
    }

    if (
      [
        "includes",
        "indexOf",
        "lastIndexOf",
        "findIndex",
        "findLastIndex",
        "every",
        "some",
      ].includes(key)
    ) {
      acc[key] = function (...args) {
        // 1. 正常找 // this-->proxy
        const res = originFn.apply(this, args);
        // 2. 找不到，从原始对象中重新找一遍
        if (res < 0 || res === false) {
          return originFn.apply(this[RAW], args);
        }
        return res;
      };
    } else {
      acc[key] = function (...args) {
        return originFn.apply(this, args);
      };
    }

    return acc;
  },
  {}
);

function get(target, key, receiver) {
  if (key === RAW) {
    return target;
  }

  if (arrayInstrumentations.hasOwnProperty(key) && Array.isArray(target)) {
    return arrayInstrumentations[key].bind(receiver);
  }

  const result = Reflect.get(target, key, receiver);
  if (isObject(result)) {
    return reactive(result);
  }
  return result;
}

function set(target, key, value, receiver) {
  const type = target.hasOwnProperty(key) ? "SET" : "ADD";
  const oldValue = target[key];
  const result = Reflect.set(target, key, value, receiver);
  if (!result) {
    return result;
  }

  if (hasChanged(oldValue, value) || type === "ADD") {
    console.log(`${type} [key: ${key}]`);
  }
  return result;
}

function deleteProperty(target, key) {
  const hadKey = target.hasOwnProperty(key);
  const result = Reflect.deleteProperty(target, key);
  if (hadKey && result) {
    console.log(`DELETE [key: ${key}]`);
  }
  return result;
}

const targetMap = new WeakMap();

const genProxy = (target) => {
  const proxy = new Proxy(target, {
    get,
    set,
    deleteProperty,
  });

  if (Array.isArray(target)) {
    return new Proxy(
      {},
      {
        get(_, key, receiver) {
          if (key === "length") {
            return proxy.length;
          } else {
            return proxy[key];
          }
        },
        set(_, key, value, receiver) {
          if (key === "length") {
            proxy.splice(value);
          } else {
            proxy[key] = value;
          }
        },
        deleteProperty(_, key) {
          delete proxy[key];
        },
      }
    );
  }

  return proxy;
};

function reactive(target) {
  if (!isObject(target)) {
    return target; // 如果不是对象，直接返回
  }
  if (targetMap.has(target)) {
    return targetMap.get(target); // 如果已经代理过了，直接返回
  }

  const proxy = genProxy(target);
  targetMap.set(target, proxy);
  return proxy;
}
