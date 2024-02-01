import { iterateObjectPaths } from "./objectPaths.js";
import get from "lodash/get.js";

export const initTimestamp = (nodeId = 0) => `${nodeId}-0`;

export const incrementTimestamp = (timestamp) => {
  const [nodeId, time] = timestamp.split("-");
  return `${parseInt(nodeId)}-${parseInt(time) + 1}`;
};

export const validateTimestamp = (timestamp) => {
  return /^\d+-\d+$/.test(timestamp);
};

export const counterFromTimestamp = (timestamp) => {
  return parseInt(timestamp.split("-")[1]);
};

export const nodeIdFromTimestamp = (timestamp) => {
  return parseInt(timestamp.split("-")[0]);
};

export const compareTimestamps = (timestamp1, timestamp2) => {
  if (!validateTimestamp(timestamp1) || !validateTimestamp(timestamp2)) {
    throw new Error(`Invalid timestamp in ${timestamp1} or ${timestamp2}`);
  }
  const [nodeId1, time1] = timestamp1.split("-").map((x) => parseInt(x));
  const [nodeId2, time2] = timestamp2.split("-").map((x) => parseInt(x));
  return time1 > time2 || (time1 === time2 && nodeId1 > nodeId2);
};

export const getHighestTimestamp = (timestamps) => {
  if (typeof timestamps !== "object") {
    throw new Error("Timestamps must be object");
  }

  let maxTimestamp = initTimestamp();
  iterateObjectPaths(timestamps, (path) => {
    const timestamp = get(timestamps, path);
    if (typeof timestamp !== "string") {
      throw new Error(`Timestamps must be strings but is ${typeof timestamp}`);
    }
    if (!validateTimestamp(timestamp)) {
      throw new Error(`Invalid timestamp: ${timestamp}`);
    }
    if (compareTimestamps(timestamp, maxTimestamp)) {
      maxTimestamp = timestamp;
    }
  });

  return maxTimestamp;
};

/**
 * 一个简单的时钟，用于跟踪当前时间戳。
 * 此外，它还使用 nodeId 来打破具有相同时间戳的计数器之间的联系。
 */
export class Clock {
  constructor(nodeId, count = 0) {
    if (nodeId < 0 || !Number.isInteger(nodeId)) {
      throw new Error("nodeId must be a positive integer");
    }
    this.nodeId = nodeId;
    this.count = count;
  }
  tick() {
    this.count++;
    return this.timestamp();
  }
  update(timestamp) {
    const counter = counterFromTimestamp(timestamp);
    this.count = Math.max(this.count, counter);
  }
  timestamp() {
    return `${this.nodeId}-${this.count}`;
  }
  toString() {
    return this.timestamp();
  }
  counter() {
    return this.count;
  }

  static fromString(timestamp) {
    const [nodeId, count] = timestamp.split("-").map((x) => parseInt(x));
    return new Clock(nodeId, count);
  }
}
