import get from "lodash/get.js";
import setWith from "lodash/setWith.js";
import cloneDeep from "lodash/cloneDeep.js";
import { compareTimestamps, initTimestamp } from "./clock.js";
import { iterateObjectPaths } from "./objectPaths.js";

const isItemArray = (value) => {
  return (
    Array.isArray(value) &&
    value.length &&
    value.every(
      (v) => typeof v === "object" && !!v && "id" in v && v.id !== void 0
    )
  );
};

/**
 * 将项目数组转换为其内部对象表示法 与 objectToItemArray 相反的函数
 */
function itemArrayToObject(arr) {
  const obj = { _order: arr.map((item) => item.id) };
  for (const item of arr) {
    if (Object.keys(item).length !== 1) {
      setWith(obj, [item.id], item, Object);
    }
  }
  return obj;
}

/**
 * 项目数组的对象表示转换回数组 与 itemArrayToObject 相反的函数
 */
function objectToItemArray(obj) {
  const order = get(obj, ["_order"]);
  if (!Array.isArray(order)) {
    throw new Error(`_order must be an array`);
  }
  const array = order.map((id) => get(obj, [id])).filter(Boolean);
  return array;
}

/**
 * CRDT 实现使用单一计数器跟踪更新。
 * 它只有一个更新方法，需要一个数据补丁和一个时间戳补丁。
 * 用户必须在该类之外自行跟踪计数器。
 */
export class CRDT {
  /**
   * 用给定的数据和可选的时间戳构建一个新的 CRDT 实例。
   */
  constructor(data, timestamps) {
    this.dataObj = this.initData(data);
    this.timestampObj = timestamps ?? {};
    this.pathToItemArrays = this.initPathToItemArrays();
    this.log = {
      receivedUpdates: 0,
      appliedUpdates: 0,
    };
  }
  /**
   * 将原始数据转换为项目数组的对象表示法
   */
  initData(data) {
    iterateObjectPaths(data, (path) => {
      let patchValue = get(data, path);
      if (isItemArray(patchValue)) {
        patchValue = itemArrayToObject(patchValue);
      }
      setWith(data, path, patchValue, Object);
    });
    return data;
  }
  /**
   * 获取内部数据对象中 item 为数组的所有路径
   */
  initPathToItemArrays() {
    const pathToItemArrays = new Set();
    iterateObjectPaths(this.dataObj, (path) => {
      const lastPathElement = path.pop();
      if (lastPathElement === "_order") {
        pathToItemArrays.add(path.join("."));
      }
    });
    return pathToItemArrays;
  }

  /** 获取指定路径的时间戳。
   * 如果路径没有时间戳，则向上遍历路径，直到找到时间戳/对象。
   * 如果在路径遍历过程中找到了一个对象，或没有带有路径的父值，则返回最小时间戳。
   */
  getTimestamp(path) {
    const searchPath = [...path];
    let timestamp = void 0;
    while (searchPath.length && timestamp === void 0) {
      timestamp = get(this.timestampObj, searchPath);
      searchPath.pop();
    }

    return timestamp && typeof timestamp !== "object"
      ? timestamp
      : initTimestamp();
  }

  /**
   * 如果时间戳高于当前时间戳，则在数据对象中插入一个值。
   */
  upsertValue(path, value, timestamp) {
    this.log.receivedUpdates += 1;
    const currentTimestamp = this.getTimestamp(path);
    if (compareTimestamps(timestamp, currentTimestamp)) {
      setWith(this.dataObj, path, value, Object);
      setWith(this.timestampObj, path, timestamp, Object);
      this.log.appliedUpdates += 1;
    }
  }

  /**
   * 如果时间戳高于当前时间戳，则向数据对象中插入一个项目数组。
   */
  upsertItemArray(path, itemArray, timestamp) {
    const itemArrayObject = itemArrayToObject(itemArray);
    const pathString = path.join(".");

    // check if the item array is not in list of item arrays (=new item array)
    if (!this.pathToItemArrays.has(pathString)) {
      const currentTimestamp = this.getTimestamp(path);
      // 只有当补丁时间戳高于当前时间戳时，我们才会进行转换
      if (compareTimestamps(currentTimestamp, timestamp)) {
        return;
      }
      const itemArrayObjectTimestamps = {};
      iterateObjectPaths(itemArrayObject, (internalPath) => {
        setWith(itemArrayObjectTimestamps, internalPath, timestamp, Object);
      });
      setWith(this.timestampObj, path, itemArrayObjectTimestamps, Object);
      setWith(this.dataObj, path, itemArrayObject, Object);
      this.pathToItemArrays.add(path.join("."));
      return;
    }

    // 遍历项目数组补丁并更新每个项目
    iterateObjectPaths(itemArrayObject, (internalPath) => {
      this.upsertValue(
        [...path, ...internalPath],
        get(itemArrayObject, internalPath),
        timestamp
      );
    });
  }

  /**
   * 用给定的数据补丁和时间戳补丁更新 CRDT。
   */
  update(patch, timestamp) {
    iterateObjectPaths(patch, (path) => {
      const patchValue = get(patch, path);
      const pathString = path.join(".");

      // 我们需要第二个检查, isItemArray 跳过了空数组
      if (isItemArray(patchValue) || this.pathToItemArrays.has(pathString)) {
        this.upsertItemArray(path, patchValue, timestamp);
      } else {
        this.upsertValue(path, patchValue, timestamp);
      }
    });
  }
  data() {
    const data = cloneDeep(this.dataObj);
    for (const path of this.pathToItemArrays) {
      const value = objectToItemArray(get(data, path));
      setWith(data, path, value, Object);
    }
    return data;
  }
  timestamps() {
    return cloneDeep(this.timestampObj);
  }
  logs() {
    return {
      ...this.log,
      successRate: this.log.appliedUpdates / this.log.receivedUpdates,
    };
  }
}
