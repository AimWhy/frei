import { Clock, getHighestTimestamp, counterFromTimestamp } from "./clock.js";
import { CRDT } from "./crdt.js";
import isEmpty from "lodash/isEmpty.js";

export class CRDTWithClock {
  constructor(nodeId, data, timestamps) {
    this.crdt = new CRDT(data, timestamps);
    
    const counter = isEmpty(timestamps)
      ? 0
      : counterFromTimestamp(getHighestTimestamp(timestamps));
    this.clock = new Clock(nodeId, counter);
  }

  /**
   * 用外来数据和时间戳更新 CRDT
   */
  foreignUpdate(patch) {
    const { data, timestamp } = patch;
    this.clock.update(timestamp);
    this.crdt.update(data, timestamp);
  }
  /**
   * 使用给定数据递增计数器并更新内部 CRDT。
   */
  selfUpdate(data) {
    const timestamp = this.clock.tick();
    this.crdt.update(data, timestamp);
    return { data, timestamp };
  }
  data() {
    return this.crdt.data();
  }
  timestamps() {
    return this.crdt.timestamps();
  }
  timestamp() {
    return this.clock.timestamp();
  }
  counter() {
    return this.clock.counter();
  }
  logs() {
    return this.crdt.logs();
  }
}
