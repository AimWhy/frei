export class DataWithExpiry {
  constructor(expiryDuration, _data) {
    this._data = _data;
    this.expiryTime = expiryDuration + Date.now();
  }
  get expired() {
    const hasExpired = this.expiryTime <= Date.now();
    if (hasExpired) {
      this._data = undefined;
    }
    return hasExpired;
  }
  get data() {
    if (this.expired) {
      this._data = undefined;
    }
    return this._data;
  }
}

const globalCacheStore = new Map();

export function getGlobalCacheStore() {
  return globalCacheStore;
}

export class InMemoryCache {
  constructor(expiryDurationMs, cacheKey = "") {
    this.expiryDurationMs = expiryDurationMs;
    this.cacheKey = cacheKey;
  }
  get hasData() {
    const store = globalCacheStore.get(this.cacheKey);
    return store && !store.expired ? true : false;
  }
  /**
   * Returns undefined if there is no data.
   * Uses `hasData` to determine whether any cached data exists.
   *
   * @readonly
   * @type {(T | undefined)}
   * @memberof InMemoryCache
   */
  get data() {
    if (!this.hasData) {
      return;
    }
    const store = globalCacheStore.get(this.cacheKey);
    return store?.data;
  }
  set data(value) {
    const store = new DataWithExpiry(this.expiryDurationMs, value);
    globalCacheStore.set(this.cacheKey, store);
  }
  clear() {
    globalCacheStore.delete(this.cacheKey);
  }
}
