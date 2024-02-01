export const SESSION = {
  SYSTEM: 0,
  SERVER: 1,
  MAX: 9007199254740991,
};

export class Timestamp {
  constructor(sid, time) {
    this.sid = sid;
    this.time = time;
  }
}

export class Timespan {
  constructor(sid, time, span) {
    this.sid = sid;
    this.time = time;
    this.span = span;
  }
}

export const ts = (sid, time) => new Timestamp(sid, time);

export const tss = (sid, time, span) => new Timespan(sid, time, span);

export const tick = (stamp, cycles) => ts(stamp.sid, stamp.time + cycles);

export const equal = (ts1, ts2) => ts1.time === ts2.time && ts1.sid === ts2.sid;

export const compare = (ts1, ts2) => {
  const t1 = ts1.time;
  const t2 = ts2.time;
  if (t1 > t2) return 1;
  if (t1 < t2) return -1;
  const s1 = ts1.sid;
  const s2 = ts2.sid;
  if (s1 > s2) return 1;
  if (s1 < s2) return -1;
  return 0;
};

export const contains = (ts1, span1, ts2, span2) => {
  if (ts1.sid !== ts2.sid) return false;
  const t1 = ts1.time;
  const t2 = ts2.time;
  if (t1 > t2) return false;
  if (t1 + span1 < t2 + span2) return false;
  return true;
};

export const containsId = (ts1, span1, ts2) => {
  if (ts1.sid !== ts2.sid) return false;
  const t1 = ts1.time;
  const t2 = ts2.time;
  if (t1 > t2) return false;
  if (t1 + span1 < t2 + 1) return false;
  return true;
};

export const toDisplayString = (id) => {
  if (id.sid === SESSION.SERVER) return "." + id.time;
  let session = "" + id.sid;
  if (session.length > 4) session = ".." + session.slice(session.length - 4);
  return session + "." + id.time;
};

export const interval = (ts, tick, span) =>
  new Timespan(ts.sid, ts.time + tick, span);

export class LogicalClock extends Timestamp {
  tick(cycles) {
    const timestamp = new Timestamp(this.sid, this.time);
    this.time += cycles;
    return timestamp;
  }
}

export class ClockVector extends LogicalClock {
  constructor() {
    super(...arguments);
    this.peers = new Map();
  }

  observe(id, span) {
    const edge = id.time + span - 1;
    const sid = id.sid;
    if (sid !== this.sid) {
      const clock = this.peers.get(id.sid);
      if (!clock) this.peers.set(id.sid, ts(sid, edge));
      else if (edge > clock.time) clock.time = edge;
    }
    if (edge >= this.time) this.time = edge + 1;
  }

  clone() {
    return this.fork(this.sid);
  }

  fork(sessionId) {
    const clock = new ClockVector(sessionId, this.time);
    if (sessionId !== this.sid) clock.observe(tick(this, -1), 1);
    this.peers.forEach((peer) => {
      clock.observe(peer, 1);
    });
    return clock;
  }

  toString(tab = "") {
    const last = this.peers.size;
    let i = 1;
    let lines = "";
    this.peers.forEach((clock) => {
      const isLast = i === last;
      lines += `\n${tab}${isLast ? "└─" : "├─"} ${clock.sid}.${clock.time}`;
      i++;
    });
    return `clock ${this.sid}.${this.time}${lines}`;
  }
}

export class ServerClockVector extends LogicalClock {
  constructor() {
    super(...arguments);
    this.peers = new Map();
  }
  observe(ts, span) {
    if (ts.sid !== SESSION.SERVER) throw new Error("INVALID_SERVER_SESSION");
    if (this.time < ts.time) throw new Error("TIME_TRAVEL");
    const time = ts.time + span;
    if (time > this.time) this.time = time;
  }
  clone() {
    return this.fork();
  }
  fork() {
    return new ServerClockVector(SESSION.SERVER, this.time);
  }

  toString() {
    return `clock ${this.sid}.${this.time}`;
  }
}
