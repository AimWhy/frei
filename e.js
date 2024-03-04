// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
/**
 *  Add RPC capability to WebSocket command channel.
 *
 *  Suppose you want to run `new Foo(1, 2).on('event', localListener)` on a remote worker,
 *  use the following steps:
 *
 *   0. Create RPC helper on each side of the channel:
 *
 *          const rpcLocal = getRpcHelper(localChannel);  // at local side
 *          const rpcRemote = getRpcHelper(remoteChannel);  // at remote side
 *
 *   1. Register the class at remote:
 *
 *          rpcRemote.registerClass('Foo', Foo);
 *
 *   2. Construct an object at local:
 *
 *          const obj = await rpcLocal.construct('Foo', [ 1, 2 ]);
 *
 *   3. Call the method at local:
 *
 *          const result = await rpcLocal.call(obj, 'on', [ 'event' ], [ listener ]);
 *
 *  RPC methods can only have parameters of JSON and function types,
 *  and all callbacks must appear after JSON parameters.
 *
 *  This utility has limited support for exceptions.
 *  If the remote method throws an Error, `rpc.call()` will throw an Error as well.
 *  The local error message contains `inspect(remoteError)` and should be sufficient for debugging purpose.
 *  However, those two errors are totally different objects so don't try to write concrete error handlers.
 *
 *  Underlying, it uses a protocal similar to JSON-RPC:
 *
 *      ->  { type: 'rpc_constructor', id: 1, className: 'Foo', parameters: [ 1, 2 ] }
 *      <-  { type: 'rpc_response', id: 1 }
 *
 *      ->  { type: 'rpc_method', id: 2, objectId: 1, methodName: 'bar', parameters: [ 'event' ], callbackIds: [ 3 ] }
 *      <-  { type: 'rpc_response', id: 2, result: 'result' }
 *
 *      <-  { type: 'rpc_callback', id: 4, callbackId: 3, parameters: [ 'baz' ] }
 **/
const rpcHelpers = new Map();

export class DefaultMap extends Map {
  constructor(defaultFactory) {
    super();
    this.defaultFactory = defaultFactory;
  }
  get(key) {
    const value = super.get(key);
    if (value !== undefined) {
      return value;
    }
    const defaultValue = this.defaultFactory();
    this.set(key, defaultValue);
    return defaultValue;
  }
}

export class Deferred {
  constructor() {
    this.resolveCallbacks = [];
    this.rejectCallbacks = [];
    this.isResolved = false;
    this.isRejected = false;

    this.resolve = (value) => {
      if (!this.isResolved && !this.isRejected) {
        this.isResolved = true;
        this.resolvedValue = value;
        for (const callback of this.resolveCallbacks) {
          callback(value);
        }
      } else if (this.isResolved && this.resolvedValue === value) {
        console.debug("Double resolve:", value);
      } else {
        const msg = this.errorMessage("trying to resolve with value: " + value);
        throw new Error("Conflict Deferred result. " + msg);
      }
    };
    this.reject = (reason) => {
      if (!this.isResolved && !this.isRejected) {
        this.isRejected = true;
        this.rejectedReason = reason;
        for (const callback of this.rejectCallbacks) {
          callback(reason);
        }
      } else if (this.isRejected) {
        console.warning("Double reject:", this.rejectedReason, reason);
      } else {
        const msg = this.errorMessage(
          "trying to reject with reason: " + reason
        );
        throw new Error("Conflict Deferred result. " + msg);
      }
    };
  }
  get promise() {
    if (this.isResolved) {
      return Promise.resolve(this.resolvedValue);
    }
    if (this.isRejected) {
      return Promise.reject(this.rejectedReason);
    }
    return new Promise((resolutionFunc, rejectionFunc) => {
      this.resolveCallbacks.push(resolutionFunc);
      this.rejectCallbacks.push(rejectionFunc);
    });
  }
  get settled() {
    return this.isResolved || this.isRejected;
  }
  errorMessage(curStat) {
    let prevStat = "";
    if (this.isResolved) {
      prevStat = "Already resolved with value: " + this.resolvedValue;
    }
    if (this.isRejected) {
      prevStat = "Already rejected with reason: " + this.rejectedReason;
    }
    return prevStat + " ; " + curStat;
  }
}

export function getRpcHelper(channel) {
  if (!rpcHelpers.has(channel)) {
    rpcHelpers.set(channel, new RpcHelper(channel));
  }
  return rpcHelpers.get(channel);
}

export class RpcHelper {
  /**
   *  NOTE: Don't use this constructor directly. Use `getRpcHelper()`.
   **/
  constructor(channel) {
    this.lastId = 0;
    this.localCtors = new Map();
    this.localObjs = new Map();
    this.localCbs = new Map();
    this.responses = new DefaultMap(() => new Deferred());

    this.channel = channel;
    this.channel.onCommand("rpc_constructor", (command) => {
      this.invokeLocalConstructor(
        command.id,
        command.className,
        command.parameters
      );
    });
    this.channel.onCommand("rpc_method", (command) => {
      this.invokeLocalMethod(
        command.id,
        command.objectId,
        command.methodName,
        command.parameters,
        command.callbackIds
      );
    });
    this.channel.onCommand("rpc_callback", (command) => {
      this.invokeLocalCallback(
        command.id,
        command.callbackId,
        command.parameters
      );
    });
    this.channel.onCommand("rpc_response", (command) => {
      this.responses.get(command.id).resolve(command);
    });
  }
  /**
   *  Register a class for RPC use.
   *
   *  This method must be called at remote side before calling `construct()` at local side.
   *  To ensure this, the client can call `getRpcHelper().registerClass()` before calling `connect()`.
   **/
  registerClass(className, constructor) {
    this.localCtors.set(className, constructor);
  }
  /**
   *  Construct a class object remotely.
   *
   *  Must be called after `registerClass()` at remote side, or an error will be raised.
   **/
  construct(className, parameters) {
    return this.invokeRemoteConstructor(className, parameters ?? []);
  }
  /**
   *  Call a method on a remote object.
   *
   *  The `objectId` is the return value of `construct()`.
   *
   *  If the method returns a promise, `call()` will wait for it to resolve.
   **/
  call(objectId, methodName, parameters, callbacks) {
    return this.invokeRemoteMethod(
      objectId,
      methodName,
      parameters ?? [],
      callbacks ?? []
    );
  }
  async invokeRemoteConstructor(className, parameters) {
    const id = this.generateId();
    this.channel.send({ type: "rpc_constructor", id, className, parameters });
    await this.waitResponse(id);
    return id;
  }
  invokeLocalConstructor(id, className, parameters) {
    const ctor = this.localCtors.get(className);
    if (!ctor) {
      this.sendRpcError(id, `Unknown class name ${className}`);
      return;
    }
    let obj;
    try {
      obj = new ctor(...parameters);
    } catch (error) {
      this.sendError(id, error);
      return;
    }
    this.localObjs.set(id, obj);
    this.sendResult(id, undefined);
  }
  async invokeRemoteMethod(objectId, methodName, parameters, callbacks) {
    const id = this.generateId();
    const callbackIds = this.generateCallbackIds(callbacks);
    this.channel.send({
      type: "rpc_method",
      id,
      objectId,
      methodName,
      parameters,
      callbackIds,
    });
    return await this.waitResponse(id);
  }
  async invokeLocalMethod(id, objectId, methodName, parameters, callbackIds) {
    const obj = this.localObjs.get(objectId);
    if (!obj) {
      this.sendRpcError(id, `Non-exist object ${objectId}`);
      return;
    }
    const callbacks = this.createCallbacks(callbackIds);
    let result;
    try {
      result = obj[methodName](...parameters, ...callbacks);
      if (typeof result === "object" && result.then) {
        result = await result;
      }
    } catch (error) {
      this.sendError(id, error);
      return;
    }
    this.sendResult(id, result);
  }
  invokeRemoteCallback(callbackId, parameters) {
    const id = this.generateId(); // for debug purpose
    this.channel.send({ type: "rpc_callback", id, callbackId, parameters });
  }
  invokeLocalCallback(_id, callbackId, parameters) {
    const cb = this.localCbs.get(callbackId);
    if (cb) {
      cb(...parameters);
    } else {
    }
  }
  generateId() {
    this.lastId += 1;
    return this.lastId;
  }
  generateCallbackIds(callbacks) {
    const ids = [];
    for (const cb of callbacks) {
      const id = this.generateId();
      ids.push(id);
      this.localCbs.set(id, cb);
    }
    return ids;
  }
  createCallbacks(callbackIds) {
    return callbackIds.map((id) => (...args) => {
      this.invokeRemoteCallback(id, args);
    });
  }
  sendResult(id, result) {
    try {
      JSON.stringify(result);
    } catch {
      this.sendRpcError(id, "method returns non-JSON value ");
      return;
    }
    this.channel.send({ type: "rpc_response", id, result });
  }
  sendError(id, error) {
    const msg = String(error.stack);
    this.channel.send({ type: "rpc_response", id, error: msg });
  }
  sendRpcError(id, message) {
    this.channel.send({
      type: "rpc_response",
      id,
      error: `RPC framework error: ${message}`,
    });
  }
  async waitResponse(id) {
    const deferred = this.responses.get(id);
    const res = await deferred.promise;
    if (res.error) {
      throw new Error(`RPC remote error:\n${res.error}`);
    }
    return res.result;
  }
}
