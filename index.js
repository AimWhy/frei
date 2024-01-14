(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? factory(exports)
    : typeof define === "function" && define.amd
    ? define(["exports"], factory)
    : ((global =
        typeof globalThis !== "undefined" ? globalThis : global || self),
      factory((global.frei = {})));
})(this, function (exports) {
  "use strict";

  const jsx = (type, props = {}, key = null) => ({
    key,
    type,
    props,
    $$typeof: true,
  });

  const Fragment = (props) => props.children;

  const FiberPools = new Map();

  function reuseFiber(element, nodeKey) {
    const fiberType = element.type;

    if (!FiberPools.has(fiberType)) {
      return null;
    }

    const pool = FiberPools.get(fiberType);
    if (!pool.length) {
      return null;
    }

    const result = pool.pop();
    unMarkUnMount(result);

    if (result.isFunctionComponent) {
      result.stateNode.reset(nodeKey);
    }

    return result;
  }

  function recycleFiber(fiber) {
    let pool;
    const fiberType = fiber.type;

    if (!FiberPools.has(fiberType)) {
      pool = [];
      FiberPools.set(fiberType, pool);
    } else {
      pool = FiberPools.get(fiberType);
    }

    markUnMount(fiber);
    pool.push(fiber);
  }

  const noop = (_) => _;
  const isArray = (val) => Array.isArray(val);
  const isString = (val) => "string" === typeof val;
  const isFunction = (val) => "function" === typeof val;
  const print = (method, ...args) => {
    if (false) {
      console[method](...args);
    }
  };

  const objectEqual = (object1, object2, isDeep) => {
    if (object1 === object2) {
      return true;
    }

    if (
      object1 === null ||
      object2 === null ||
      "object" !== typeof object1 ||
      "object" !== typeof object2
    ) {
      return false;
    }

    if (object1.constructor !== object2.constructor) {
      isDeep && isDeep(object1, object2);
      return false;
    }

    if (isArray(object1) && object1.length !== object2.length) {
      isDeep && isDeep(object1, object2);
      return false;
    }

    const keys1 = Object.keys(object1);
    const keyLen1 = keys1.length;
    const keyLen2 = Object.keys(object2).length;

    if (keyLen1 !== keyLen2) {
      isDeep && isDeep(object1, object2);
      return false;
    }

    for (const key of keys1) {
      const o1 = object1[key];
      const o2 = object2[key];

      if (isDeep) {
        if (o1 !== o2 && !objectEqual(o1, o2, isDeep)) {
          isDeep(object1, object2);
          return false;
        }
      } else {
        if (o1 !== o2) {
          return false;
        }
      }
    }

    return true;
  };

  const NoEqualPropMap = new Map();
  const addNoEqualProp = (a, b) => {
    NoEqualPropMap.set(a, b);
  };

  const propsEqual = (props1, props2, isElement = false) => {
    if (
      props1 != null &&
      "object" === typeof props1 &&
      NoEqualPropMap.has(props1) &&
      NoEqualPropMap.get(props1) === props2
    ) {
      print("log", "Equal Reuse Count", props1, isElement);
      return false;
    }

    return objectEqual(props1, props2, addNoEqualProp);
  };

  const isSpecialBooleanAttr = (val) =>
    "allowfullscreen" === val ||
    "formnovalidate" === val ||
    "novalidate" === val ||
    "itemscope" === val ||
    "nomodule" === val ||
    "readonly" === val ||
    "ismap" === val;

  const includeBooleanAttr = (value) => value === "" || !!value;

  const genQueueMacrotask = (macrotaskName) => {
    const FrameYieldMs = 10;
    const ThrottleCount = 30;
    const scheduledQueue = [];
    const channel = new MessageChannel();

    let isLoopRunning = false;
    channel.port1.onmessage = () => {
      if (!scheduledQueue.length) {
        isLoopRunning = false;
        return;
      }

      let count = 0;
      const timeoutTime = Date.now() + FrameYieldMs;

      try {
        while (
          scheduledQueue.length > 0 &&
          (count !== 0 || Date.now() <= timeoutTime)
        ) {
          const work = scheduledQueue[scheduledQueue.length - 1];

          // 执行前记录一下 len, 执行完后再记录一下 len, 判断是否有添加
          const next = work();

          if (next === true) {
            // 不丢弃 (不删除尾部work, 下次执行还是它)
          } else if (isFunction(next)) {
            scheduledQueue[scheduledQueue.length - 1] = next;
          } else {
            scheduledQueue.length -= 1;
          }
          count = (count + 1) % ThrottleCount;
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (scheduledQueue.length > 0) {
          schedulePerform();
        } else {
          isLoopRunning = false;
        }
      }
    };

    const schedulePerform = () => channel.port2.postMessage(null);

    return (task) => {
      scheduledQueue.unshift(task);

      if (!isLoopRunning) {
        isLoopRunning = true;
        schedulePerform();
      }
    };
  };

  const mainQueueMacrotask = genQueueMacrotask("main-macro-task");
  const effectQueueMacrotask = genQueueMacrotask("effect-macro-task");

  const $ElementPropsKey = Symbol.for("frei.Fiber");

  /* #region 事件相关 */
  const toEventName = (eventType) =>
    `on${eventType[0].toUpperCase()}${eventType.slice(1)}`;

  const eventTypeMap = `click,dblclick,mousedown,mouseup,mousemove,
  keydown,keyup,keypress,submit,touchstart,touchend,touchmove`
    .split(/[^a-z]+/)
    .reduce((map, eventType) => {
      const eventName = toEventName(eventType);
      map[eventType] = [`${eventName}Capture`, eventName];
      return map;
    }, {});

  const collectPaths = (targetElement, container, eventType) => {
    const paths = {
      capture: [],
      bubble: [],
    };

    while (targetElement && targetElement !== container) {
      const eventNameList = eventTypeMap[eventType];
      const elementProps = targetElement[$ElementPropsKey]
        ? targetElement[$ElementPropsKey].memoizedProps
        : null;

      if (elementProps && eventNameList) {
        const [captureName, bubbleName] = eventNameList;
        if (elementProps[captureName]) {
          paths.capture.unshift(elementProps[captureName]);
        }

        if (elementProps[bubbleName]) {
          paths.bubble.push(elementProps[bubbleName]);
        }
      }
      targetElement = targetElement.parentNode;
    }

    return paths;
  };

  const createSyntheticEvent = (e) => {
    const syntheticEvent = e;
    const originStopPropagation = e.stopPropagation;

    syntheticEvent.__stopPropagation = false;
    syntheticEvent.stopPropagation = () => {
      syntheticEvent.__stopPropagation = true;
      if (originStopPropagation) {
        originStopPropagation();
      }
    };

    return syntheticEvent;
  };

  const triggerEventFlow = (paths, se) => {
    for (let i = 0; i < paths.length; i++) {
      const callback = paths[i];
      callback.call(null, se);
      if (se.__stopPropagation) {
        return;
      }
    }
  };

  const dispatchEvent = (container, eventType, e) => {
    const targetElement = e.target;

    if (!targetElement) {
      return console.warn("事件不存在target", e);
    }

    const { bubble, capture } = collectPaths(
      targetElement,
      container,
      eventType
    );
    const se = createSyntheticEvent(e);

    triggerEventFlow(capture, se);

    if (!se.__stopPropagation) {
      triggerEventFlow(bubble, se);
    }
  };

  const initEvent = (container, eventType) => {
    container.addEventListener(eventType, (e) => {
      dispatchEvent(container, eventType, e);
    });
  };

  const testHostSpecialAttr = (name) => /^on[A-Z]/.test(name);
  const hostSpecialAttrSet = new Set(
    `onLoad,onBeforeunload,onUnload,onScroll,onFocus,onBlur,
    onPointerenter,onPointerleave,onInput`.split(/[^a-zA-Z]+/)
  );

  const onCompositionStart = (e) => {
    e.target.composing = true;
  };
  const onCompositionEnd = (e) => {
    if (e.target.composing) {
      e.target.composing = false;
      e.target.dispatchEvent(new Event("input"));
    }
  };
  const onInputFixed = (e) => {
    if (!e.target.composing) {
      eventCallback(e);
    }
  };
  const eventCallback = (e) => {
    const pKey = toEventName(e.type);
    const elementProps = e.target[$ElementPropsKey]
      ? e.target[$ElementPropsKey].memoizedProps
      : null;

    if (elementProps && elementProps[pKey]) {
      elementProps[pKey](e);
    }
  };

  const camelizePlacer = (_, c) => (c ? c.toUpperCase() : "");
  const camelize = (str) => str.replace(/-(\w)/g, camelizePlacer);

  const setStyle = (style, name, val) => {
    if (isArray(val)) {
      val.forEach((v) => setStyle(style, name, v));
    } else {
      if (val == null) {
        val = "";
      }
      if (name.startsWith("--")) {
        style.setProperty(name, val);
      } else {
        style[camelize(name)] = val;
      }
    }
  };

  const domHostConfig = {
    attrMap: {
      className: "class",
      htmlFor: "for",
    },
    fixAttrName(key) {
      return domHostConfig.attrMap[key] || key;
    },
    createInstance(type) {
      return document.createElement(type);
    },
    createComment(comment) {
      return document.createComment(comment);
    },
    createTextInstance(text) {
      return document.createTextNode(text);
    },
    createFragment() {
      return document.createDocumentFragment();
    },
    toFirst(child, reference) {
      reference.insertBefore(
        isVNode(child) ? child.toFragment() : child,
        reference.firstChild
      );
    },
    toLast(child, reference) {
      reference.appendChild(isVNode(child) ? child.toFragment() : child);
    },
    toBefore(node, reference) {
      reference.parentNode.insertBefore(
        isVNode(node) ? node.toFragment() : node,
        reference
      );
    },
    toAfter(node, reference) {
      reference.parentNode.insertBefore(
        isVNode(node) ? node.toFragment() : node,
        reference.nextSibling
      );
    },
    removeChildren(node) {
      if (isVNode(node)) {
        const startNode = node.startNode;
        const endNode = node.endNode;
        const parentNode = startNode.parentNode;
        while (startNode.nextSibling !== endNode) {
          parentNode.removeChild(startNode.nextSibling);
        }
      } else {
        while (node.firstChild) {
          node.removeChild(node.firstChild);
        }
      }
    },
    removeNode(node) {
      if (isVNode(node)) {
        const startNode = node.startNode;
        const endNode = node.endNode;
        const parentNode = startNode.parentNode;
        while (startNode.nextSibling !== endNode) {
          parentNode.removeChild(startNode.nextSibling);
        }
        parentNode.removeChild(startNode);
        parentNode.removeChild(endNode);
      } else {
        node.parentNode.removeChild(node);
      }
    },
    commitTextUpdate(node, content) {
      node.nodeValue = content;
    },
    commitInstanceUpdate(node, attrArr) {
      for (let i = 0; i < attrArr.length; i = i + 2) {
        const pKey = attrArr[i];
        const pValue = attrArr[i + 1];

        if (pValue === SkipEventFunc) {
          continue;
        }

        if (hostSpecialAttrSet.has(pKey)) {
          domHostConfig.fixHostSpecial(node, pKey, pValue);
          continue;
        }

        const attrName = domHostConfig.fixAttrName(pKey);
        if (pValue === void 0) {
          node.removeAttribute(attrName);
        } else if (attrName === "style") {
          if (isString(pValue)) {
            node.style.cssText = pValue;
          } else {
            for (const key in pValue) {
              setStyle(node.style, key, pValue[key]);
            }
          }
        } else {
          node.setAttribute(attrName, pValue);
        }
      }
    },
    fixHostSpecial(node, eventName, callback) {
      const eventType = eventName.slice(2).toLowerCase();
      const method =
        callback === void 0 ? "removeEventListener" : "addEventListener";

      if (eventType === "input") {
        node[method]("compositionstart", onCompositionStart);
        node[method]("compositionend", onCompositionEnd);
        node[method]("change", onCompositionEnd);
        node[method]("input", onInputFixed);
      } else {
        node[method](eventType, eventCallback);
      }
    },
    updateInstanceProps(node, fiber) {
      node[$ElementPropsKey] = fiber;
    },
    genRestoreDataFn() {
      const focusedElement = document.activeElement;
      const start = focusedElement.selectionStart;
      const end = focusedElement.selectionEnd;

      // 重新定位焦点, 恢复选择位置
      return () => {
        if (focusedElement.isConnected) {
          focusedElement.focus();
          focusedElement.selectionStart = start;
          focusedElement.selectionEnd = end;
        }
      };
    },
  };

  const isVNode = (o) => isFunction(o.toFragment);

  class VNode {
    constructor(key) {
      this.fg = domHostConfig.createFragment();
      this.startNode = domHostConfig.createComment(`start:${key}`);
      this.endNode = domHostConfig.createComment(`end:${key}`);
      this.reset();
    }
    toFragment() {
      // 非首次渲染时, 将 startNode 和 endNode 之间的内容移动到 fg 中
      if (!this.fg.hasChildNodes()) {
        let current = this.startNode;
        while (current) {
          const nextSibling = current.nextSibling;
          this.fg.appendChild(current);
          if (current === this.endNode) {
            break;
          } else {
            current = nextSibling;
          }
        }
      }
      return this.fg;
    }
    reset(key) {
      if (key) {
        this.startNode.data = `start:${key}`;
        this.endNode.data = `end:${key}`;
      }
      while (this.fg.firstChild) {
        this.fg.removeChild(this.fg.firstChild);
      }
      this.fg.appendChild(this.startNode);
      this.fg.appendChild(this.endNode);
    }
  }

  const hostConfig = domHostConfig;

  let workInProgress = null;
  const useFiber = (isInitHook) => {
    if (isInitHook && !workInProgress.hookQueue) {
      workInProgress.hookQueue = [];
    }
    return workInProgress;
  };

  const genComponentInnerElement = (fiber) => {
    let result = null;
    const preFiber = workInProgress;

    try {
      fiber.__StateIndex = 0;
      workInProgress = fiber;
      result = fiber.type(fiber.pendingProps);
    } finally {
      workInProgress = preFiber;
    }

    return result;
  };

  const useReducer = (reducer, initialState) => {
    const fiber = useFiber(true);
    const innerIndex = fiber.__StateIndex++;
    const { hookQueue } = fiber;

    if (hookQueue.length <= innerIndex) {
      const state = isFunction(initialState) ? initialState() : initialState;

      // 协调阶段，其他事件修改了state，需要排队到下一个时间循环
      const dispatch = (action) => {
        fiber.updateQueue ||= [];
        fiber.updateQueue.push(() => {
          const newState = reducer(hookQueue[innerIndex].state, action);
          hookQueue[innerIndex].state = newState;
        });

        fiber.rerender();
      };

      hookQueue[innerIndex] = { state, dispatch };
    }

    return [hookQueue[innerIndex].state, hookQueue[innerIndex].dispatch];
  };

  const useRef = (initialValue) => {
    const fiber = useFiber(true);
    const innerIndex = fiber.__StateIndex++;
    const { hookQueue } = fiber;

    if (hookQueue.length <= innerIndex) {
      hookQueue[innerIndex] = { current: initialValue };
    }

    return hookQueue[innerIndex];
  };

  const useState = (initialState) => {
    return useReducer((state, action) => {
      return isFunction(action) ? action(state) : action;
    }, initialState);
  };

  const createContext = (initialState) => {
    return {
      Provider: (props) => {
        const fiber = useFiber();
        const { value, children } = props;

        if (value === void 0) {
          fiber.pendingProps.value = initialState;
        }

        fiber.memoizedState ||= new Set();
        fiber.memoizedState.forEach((f) => f.rerender());
        fiber.memoizedState.clear();

        return children;
      },
    };
  };

  const useContext = (context) => {
    const fiber = useFiber();
    const checkProvider = (f) => f.type === context.Provider;
    const providerFiber = findParentFiber(fiber, checkProvider);
    providerFiber.memoizedState.add(fiber);

    return providerFiber.pendingProps.value;
  };

  const useEffect = (func, dep) => {
    const fiber = useFiber(true);
    const innerIndex = fiber.__StateIndex++;
    const { hookQueue } = fiber;

    if (hookQueue.length <= innerIndex) {
      if (!fiber.onMounted) {
        Fiber.initLifecycle(fiber);
      }

      if (isArray(dep)) {
        if (!dep.length) {
          fiber.onMounted.add(func);
        } else {
          fiber.onUpdated.add(func);
        }
      } else if (Number.isNaN(dep)) {
        fiber.onBeforeMove.add(func);
      } else {
        fiber.onUpdated.add(func);
      }
      hookQueue[innerIndex] = { func, dep };
    } else {
      const { dep: oldDep, func: oldFunc } = hookQueue[innerIndex];
      if (isArray(dep) && isArray(oldDep) && dep.length && oldDep.length) {
        fiber.onUpdated.delete(oldFunc);

        if (!objectEqual(oldDep, dep)) {
          hookQueue[innerIndex] = { func, dep };
          fiber.onUpdated.add(func);
        }
      }
    }
  };

  const checkIfSnapshotChanged = ({ value, getSnapshot }) => {
    try {
      return value !== getSnapshot();
    } catch {
      return true;
    }
  };
  const useSyncExternalStore = (subscribe, getSnapshot) => {
    const value = getSnapshot();
    const [{ inst }, forceUpdate] = useState({
      inst: { value, getSnapshot },
    });

    useEffect(() => {
      if (checkIfSnapshotChanged(inst)) {
        forceUpdate({ inst });
      }

      return subscribe(() => {
        if (checkIfSnapshotChanged(inst)) {
          forceUpdate({ inst });
        }
      });
    }, [subscribe]);

    return value;
  };

  const nextHookMap = {
    onBeforeMove: "onMoved",
    onMounted: "onUnMounted",
    onUpdated: "onBeforeUpdate",
  };

  const runner = (fiber, hookName) => {
    for (const hook of fiber[hookName]) {
      const destroy = hook(fiber);

      if (isFunction(destroy) && hookName in nextHookMap) {
        const cleanName = nextHookMap[hookName];
        if (fiber[cleanName]) {
          const destroyOnce = () => {
            destroy();
            fiber[cleanName].delete(destroyOnce);
          };
          fiber[cleanName].add(destroyOnce);
        }
      }
    }
  };

  const dispatchHook = (fiber, hookName, async) => {
    if (fiber[hookName] && fiber[hookName].size) {
      if (async) {
        effectQueueMacrotask(() => runner(fiber, hookName));
      } else {
        runner(fiber, hookName);
      }
    }
  };

  const toElement = (item) => {
    const itemType = typeof item;
    if (item && itemType === "object" && item.$$typeof) {
      return item;
    } else if (itemType === "string" || itemType === "number") {
      return jsx("text", { content: item });
    } else if (isArray(item)) {
      return jsx(Fragment, { children: item });
    } else {
      return jsx("text", { content: "" });
    }
  };

  const NoFlags = 0 << 0;
  const MountFlag = 1 << 0;
  const MovedFlag = 1 << 1;
  const PortalMovedFlag = 1 << 2;
  const UpdateFlag = 1 << 3;
  const RefFlag = 1 << 4;
  const UnMountFlag = 1 << 5;

  const markUnMount = (fiber) => {
    fiber.flags |= UnMountFlag;
  };
  const unMarkUnMount = (fiber) => {
    fiber.flags &= ~UnMountFlag;
  };
  const isMarkUnMount = (fiber) => fiber.flags & UnMountFlag;
  const markUpdate = (fiber) => {
    fiber.flags |= UpdateFlag;
  };
  const isMarkUpdate = (fiber) => fiber.flags & UpdateFlag;
  const markMount = (fiber, preFiber) => {
    fiber.flags |= MountFlag;
    fiber.preReferFiber = preFiber;
  };
  const isMarkMount = (fiber) => fiber.flags & MountFlag;
  const markMoved = (fiber, preFiber) => {
    fiber.flags |= MovedFlag;
    fiber.preReferFiber = preFiber;
  };
  const markPortalMoved = (fiber, preFiber) => {
    fiber.flags |= PortalMovedFlag;
    fiber.preReferFiber = preFiber;
  };
  const unMarkMoved = (fiber) => {
    fiber.flags &= ~MovedFlag;
  };
  const isMarkMoved = (fiber) => fiber.flags & (MovedFlag | PortalMovedFlag);
  const markRef = (fiber) => {
    fiber.flags |= RefFlag;
  };
  const isMarkRef = (fiber) => fiber.flags & RefFlag;

  const EmptyProps = {};
  const resolved = Promise.resolve();
  const nextTick = (callback) => resolved.then(callback);

  const EffectFlag = 1 << 0;

  class Fiber {
    ref = null;
    key = null;
    type = null;
    nodeKey = "";
    pendingProps = EmptyProps;
    memoizedProps = EmptyProps;
    memoizedState = null;
    __StateIndex = 0;
    updateQueue = null;

    index = -1;
    oldIndex = -1;
    childrenLength = 0;
    __deletion = null;
    stateNode = null;
    preReferFiber = null;

    child = null;
    return = null;
    sibling = null;

    flags = MountFlag;
    isPortal = false;
    needRender = true;

    isHostText = false;
    isHostComponent = false;
    isFunctionComponent = false;

    get normalChildren() {
      if (this.isHostText) {
        return null;
      }

      const tempChildren = this.isHostComponent
        ? this.pendingProps.children
        : genComponentInnerElement(this);

      if (tempChildren == null) {
        return null;
      } else if (isArray(tempChildren)) {
        const len = tempChildren.length;
        const result = Array(len);
        for (let i = 0; i < len; i++) {
          result[i] = toElement(tempChildren[i]);
        }
        return result;
      } else {
        return [toElement(tempChildren)];
      }
    }

    constructor(element, nodeKey) {
      this.nodeKey = nodeKey;
      this.type = element.type;
      this.key = element.key;
      this.pendingProps = element.props;

      if (this.type === "text") {
        this.isHostText = true;
        this.stateNode = hostConfig.createTextInstance(
          this.pendingProps.content
        );

        // 文本节点，创建时直接标记更新完
        this.memoizedProps = this.pendingProps;
      } else if (isString(this.type)) {
        this.isPortal = !!this.pendingProps.__target;
        this.isHostComponent = true;
        this.stateNode = hostConfig.createInstance(this.type);

        // 常规元素，添加 $ElementPropsKey 属性指向 fiber, 用于事件委托 和 调试
        hostConfig.updateInstanceProps(this.stateNode, this);
      } else {
        this.isPortal = !!this.pendingProps.__target;
        this.isFunctionComponent = true;
        this.stateNode = new VNode(this.nodeKey);
      }
    }

    rerender() {
      // 同步执行中添加多次，只向渲染 mainQueueMacrotask 队列中添加一条
      if (!this.lock) {
        this.lock = true;
        nextTick(() => {
          this.lock = false;
        });
        mainQueueMacrotask(incomingQueue.bind(null, this));
      }
    }

    unMount(isRecycle) {
      for (const oldFiber of walkChildFiber(this)) {
        if (!oldFiber.isHostText) {
          oldFiber.unMount();
        }
      }

      if (this.isFunctionComponent) {
        if (this.hookQueue) {
          this.hookQueue.length = 0;
        }
        if (this.onMounted) {
          dispatchHook(this, "onUnMounted");
          Fiber.initLifecycle(this, true);
        }
      }

      this.ref && this.ref(null);

      if (isRecycle) {
        recycleFiber(this);
      }
    }
  }

  Fiber.genNodeKey = (element, index) =>
    `${isString(element.type) ? element.type : element.type.name}#${
      element.key != null ? element.key : index
    }`;
  Fiber.isReuseFiber = (fiber, element, index) =>
    fiber.type === element.type &&
    (fiber.key != null
      ? fiber.key === element.key
      : element.key == null && fiber.index === index);

  Fiber.initLifecycle = (fiber, isUnmount) => {
    if (isUnmount) {
      fiber.onMounted.clear();
      fiber.onUnMounted.clear();
      fiber.onUpdated.clear();
      fiber.onBeforeUpdate.clear();
      fiber.onBeforeMove.clear();
      fiber.onMoved.clear();
    } else {
      fiber.onMounted = new Set();
      fiber.onUnMounted = new Set();
      fiber.onUpdated = new Set();
      fiber.onBeforeUpdate = new Set();
      fiber.onBeforeMove = new Set();
      fiber.onMoved = new Set();
    }
  };

  const runUpdate = (fn) => fn();
  const incomingQueue = (fiber) => {
    const destroyFiber = findParentFiber(fiber, isMarkUnMount);
    if (destroyFiber) {
      return;
    }

    if (fiber.updateQueue) {
      fiber.updateQueue.forEach(runUpdate);
      fiber.updateQueue.length = 0;
    }

    fiber.needRender = true;
    markUpdate(fiber);

    const renderContext = {
      MutationQueue: [],
      gen: genFiberTree2(fiber),
      restoreDataFn: hostConfig.genRestoreDataFn(),
    };

    return innerRender.bind(null, renderContext);
  };

  function* walkChildFiber(returnFiber) {
    let fiber = returnFiber.child;
    while (fiber) {
      yield fiber;
      fiber = fiber.sibling;
    }
  }

  const createFiber = (element, nodeKey, oldFiber) => {
    let fiber = oldFiber;

    if (!fiber) {
      fiber = reuseFiber(element, nodeKey);
      // 缓存池中取到的 fiber，重置数据属性
      if (fiber) {
        fiber.key = element.key;
        fiber.flags = NoFlags;
        fiber.nodeKey = nodeKey;
        fiber.__deletion = null;
        fiber.oldIndex = -1;

        fiber.pendingProps = element.props;
        finishedWork(fiber, false);
        fiber.needRender = true;
      }
    } else {
      fiber.oldIndex = fiber.index;
      fiber.pendingProps = element.props;
      fiber.needRender = finishedWork(fiber, false);
    }

    if (fiber) {
      fiber.sibling = null;
      fiber.return = null;
      fiber.__skip = false;
      fiber.preReferFiber = null;
      fiber.__isReuseFromMe = false;

      fiber.isPortal = !!fiber.pendingProps.__target;
    } else {
      fiber = new Fiber(element, nodeKey);
      finishedWork(fiber, true);
    }

    return fiber;
  };

  const findParentFiber = (fiber, checker) => {
    let current = fiber.return;
    while (current) {
      if (checker(current)) {
        return current;
      }
      current = current.return;
    }
  };

  const findIndex = (increasing, fiber) => {
    let i = 0;
    let j = increasing.length;
    let mid;
    let tempFiber = increasing[j - 1];

    // 如果仅更新内容，可以快速定位位置
    if (tempFiber && tempFiber.oldIndex < fiber.oldIndex) {
      return j;
    }

    while (i !== j) {
      mid = Math.floor((i + j) / 2);
      tempFiber = increasing[mid];
      if (tempFiber.oldIndex < fiber.oldIndex) {
        i = mid + 1;
      } else {
        j = mid;
      }
    }
    return i;
  };

  const isSkipFiber = (f) => !f.needRender && f.flags === NoFlags;

  const fillFiberKeyMap = (fiberKeyMap, fiberArray, startIndex, children) => {
    for (let i = startIndex; i < fiberArray.length; i++) {
      const newNodeKey = Fiber.genNodeKey(children[i], i);
      fiberArray[i] = newNodeKey;
      fiberKeyMap[newNodeKey] = i;
    }
  };

  const beginWork = (returnFiber) => {
    if (!returnFiber.needRender) {
      return returnFiber.child;
    }

    const children = returnFiber.normalChildren;
    const childLength = children ? children.length : 0;
    const newFiberKeyMap = childLength > 0 ? Object.create(null) : null;
    const newFiberArr = childLength > 0 ? Array(childLength) : null;
    let startIndex = 0;

    let reuseFiberArr;
    if (!isMarkMount(returnFiber) && returnFiber.child) {
      if (childLength > 0) {
        reuseFiberArr = [];

        const deletionArr = [];
        let isNeedRecordNodeKey = false;

        for (const oldFiber of walkChildFiber(returnFiber)) {
          if (!isNeedRecordNodeKey && startIndex < childLength) {
            if (
              Fiber.isReuseFiber(oldFiber, children[startIndex], startIndex)
            ) {
              newFiberArr[startIndex] = oldFiber;
              reuseFiberArr.push(oldFiber);
              startIndex++;
              continue;
            } else {
              isNeedRecordNodeKey = true;
              fillFiberKeyMap(
                newFiberKeyMap,
                newFiberArr,
                startIndex,
                children
              );
              startIndex = childLength - 1;
            }
          }

          const index = newFiberKeyMap[oldFiber.nodeKey];
          if (index !== void 0) {
            newFiberArr[index] = oldFiber;
            reuseFiberArr.push(oldFiber);
          } else {
            deletionArr.push(oldFiber);
          }
        }

        returnFiber.__deletion = deletionArr.length ? deletionArr : null;
      } else {
        // 若移除所有子节点，则将 __deletion 赋值为 旧的.child
        returnFiber.__deletion = returnFiber.child;
      }

      if (returnFiber.__deletion) {
        childDeletionFiber(returnFiber);
      }
    }

    for (let index = startIndex; index < childLength; index++) {
      const newNodeKey = Fiber.genNodeKey(children[index], index);
      newFiberArr[index] = newNodeKey;
    }

    returnFiber.child = null;

    const hasReuseFiber = Boolean(reuseFiberArr && reuseFiberArr.length);
    const increasing = hasReuseFiber ? [] : null;
    const indexCount = hasReuseFiber ? [] : null;

    let j = 0;
    let count = 0;
    let maxCount = 0;

    if (childLength > 0) {
      let preFiber = null;
      let noPortalPreFiber = null;
      let index = 0;

      for (const fiberOrKey of newFiberArr) {
        const isKey = isString(fiberOrKey);
        const nodeKey = isKey ? fiberOrKey : fiberOrKey.nodeKey;
        const oldFiber = isKey ? null : fiberOrKey;

        const fiber = createFiber(children[index], nodeKey, oldFiber);

        fiber.index = index;
        fiber.return = returnFiber;

        if (fiber.oldIndex === -1) {
          markMount(fiber, noPortalPreFiber);
        } else if (hasReuseFiber) {
          markMoved(fiber, noPortalPreFiber);
          if (!!fiber.memoizedProps.__target ^ fiber.isPortal) {
            markPortalMoved(fiber, noPortalPreFiber);
          }

          const i = findIndex(increasing, fiber);

          if (i + 1 > increasing.length) {
            increasing.push(fiber);
            count = increasing.length;
          } else {
            increasing[i] = fiber;
            count = i + 1;
          }
          indexCount[j++] = count;
          maxCount = maxCount > count ? maxCount : count;
        }

        if (index === 0) {
          returnFiber.child = fiber;
        } else {
          preFiber.sibling = fiber;
        }

        if (!fiber.isPortal) {
          noPortalPreFiber = fiber;
        }

        index++;

        preFiber = fiber;

        fiber.memoizedProps = fiber.pendingProps;
      }

      returnFiber.childrenLength = index;
    }

    // increasing 不一定是正确的最长递增序列，中间有些数有可能被替换了
    // 所以需要再走一遍构建 increasing 的逻辑

    if (hasReuseFiber) {
      let reuseFromFiber = null;
      for (let i = reuseFiberArr.length - 1; i > -1; i--) {
        const fiber = reuseFiberArr[i];

        // 位置复用
        if (maxCount > 0 && indexCount[i] === maxCount) {
          // increasing[maxCount - 1] = fiber;
          // 属于递增子序列里，取消标记位移
          unMarkMoved(fiber);
          maxCount--;
        }

        // 这里只考虑在 returnFiber 内部是否可以跳过
        if (isSkipFiber(fiber)) {
          if (
            childLength - 1 === fiber.index ||
            (reuseFromFiber && reuseFromFiber.index - 1 === fiber.index)
          ) {
            reuseFromFiber = fiber;
          }

          fiber.__skip = true;
        }
      }

      if (reuseFromFiber) {
        reuseFromFiber.__isReuseFromMe = true;
      }
    }

    return returnFiber.child;
  };

  const SkipEventFunc = noop;

  const finishedWork = (fiber, isMount) => {
    const oldProps = fiber.memoizedProps;
    const newProps = fiber.pendingProps;

    let hasTreeChange = isMount;
    let isNeedMarkUpdate = false;

    const oldRef = oldProps.ref;
    const newRef = newProps.ref;
    if (oldRef !== newRef) {
      fiber.ref = (instance) => {
        if (isFunction(oldRef)) {
          oldRef(null);
        } else if (oldRef && "current" in oldRef) {
          oldRef.current = null;
        }

        if (isFunction(newRef)) {
          newRef(instance);
        } else if (newRef && "current" in newRef) {
          newRef.current = instance;
        }
      };

      markRef(fiber);
    }

    if (fiber.isHostText) {
      if (!oldProps || newProps.content !== oldProps.content) {
        fiber.memoizedState = newProps.content;
        isNeedMarkUpdate = true;
      }
    } else if (fiber.isHostComponent) {
      const unionProps =
        oldProps === EmptyProps ? newProps : { ...oldProps, ...newProps };
      const result = [];

      for (const pKey in unionProps) {
        if (pKey === "children" || pKey === "ref" || pKey[0] === "_") {
          continue;
        }

        let newValue = newProps[pKey];
        let oldValue = oldProps[pKey];

        if (testHostSpecialAttr(pKey)) {
          const isFun = isFunction(newValue);

          if (isFun ^ isFunction(oldValue)) {
            if (isFun) {
              result.push(
                pKey,
                hostSpecialAttrSet.has(pKey) ? newValue : SkipEventFunc
              );
            } else {
              result.push(pKey, void 0);
            }
          }
          continue;
        }

        if (!Object.prototype.hasOwnProperty.call(newProps, pKey)) {
          if (oldValue !== void 0) {
            result.push(pKey, void 0);
          }
          continue;
        }

        const isBooleanAttr = isSpecialBooleanAttr(pKey);
        if (
          newValue == null ||
          (isBooleanAttr && !includeBooleanAttr(newValue))
        ) {
          newValue = void 0;
        } else {
          newValue = isBooleanAttr ? "" : newValue;
        }

        if (!Object.prototype.hasOwnProperty.call(oldProps, pKey)) {
          result.push(pKey, newValue);
        } else {
          if (!objectEqual(newValue, oldValue, noop)) {
            result.push(pKey, newValue);
          }
        }
      }

      isNeedMarkUpdate = isMount ? true : result.length > 0;
      fiber.memoizedState = result;

      hasTreeChange ||= !propsEqual(oldProps.children, newProps.children, true);
    } else {
      if (fiber.needRender || !propsEqual(oldProps, newProps)) {
        isNeedMarkUpdate = true;
        hasTreeChange = true;
      }
    }

    if (isNeedMarkUpdate) {
      markUpdate(fiber);
    }

    return hasTreeChange;
  };

  function* genFiberTree2(returnFiber) {
    beginWork(returnFiber);
    const queue = [returnFiber];
    let current = returnFiber.child;

    while (queue.length > 0) {
      if (!current || current.__isReuseFromMe) {
        current = queue.pop();
        yield current;
        current = current.sibling;
      } else if (current.__skip) {
        current = current.sibling;
      } else if (current.isHostText || !current.needRender) {
        yield current;
        current = current.sibling;
      } else {
        beginWork(current);
        queue.push(current);
        current = current.child;
      }
    }
  }

  const placementFiber = (fiber, isMount) => {
    const parentFiber = fiber.return;

    if (!parentFiber) {
      return;
    }

    // 它是一个 portal: 用带有 __target 指向的 stateNode
    if (fiber.isPortal) {
      hostConfig.toLast(fiber.stateNode, fiber.pendingProps.__target);
      return;
    }

    const isMountInsert = isMarkMount(parentFiber);
    const usePosition = isVNode(parentFiber.stateNode);

    if (isMountInsert) {
      if (usePosition) {
        hostConfig.toBefore(fiber.stateNode, parentFiber.stateNode.endNode);
      } else {
        hostConfig.toLast(fiber.stateNode, parentFiber.stateNode);
      }
      return;
    }

    if (fiber.preReferFiber) {
      hostConfig.toAfter(
        fiber.stateNode,
        isVNode(fiber.preReferFiber.stateNode)
          ? fiber.preReferFiber.stateNode.endNode
          : fiber.preReferFiber.stateNode
      );
      return;
    }

    if (usePosition) {
      hostConfig.toAfter(fiber.stateNode, parentFiber.stateNode.startNode);
    } else {
      hostConfig.toFirst(fiber.stateNode, parentFiber.stateNode);
    }
  };

  const updateHostFiber = (fiber) => {
    if (fiber.isHostText) {
      hostConfig.commitTextUpdate(fiber.stateNode, fiber.memoizedState);
    } else {
      hostConfig.commitInstanceUpdate(fiber.stateNode, fiber.memoizedState);
    }
  };

  const childDeletionFiber = (returnFiber) => {
    if (isArray(returnFiber.__deletion)) {
      for (const fiber of returnFiber.__deletion) {
        hostConfig.removeNode(fiber.stateNode);
        fiber.unMount(true);
      }
      returnFiber.__deletion.length = 0;
    } else {
      // 删除 旧returnFiber 的所有子节点，__deletion 指向 旧的.child

      hostConfig.removeChildren(returnFiber.stateNode);

      let current = returnFiber.__deletion;
      while (current) {
        current.unMount(true);
        current = current.sibling;
      }
      returnFiber.__deletion = null;
    }
  };

  const commitRoot = (renderContext) => {
    print("log", "MutationQueue Count: " + renderContext.MutationQueue.length);

    for (const fiber of renderContext.MutationQueue) {
      if (!fiber.isFunctionComponent) {
        if (isMarkUpdate(fiber)) {
          updateHostFiber(fiber);
        }
        if (isMarkMount(fiber)) {
          placementFiber(fiber, true);
        }
        if (isMarkMoved(fiber)) {
          placementFiber(fiber, false);
        }
        if (isMarkRef(fiber)) {
          fiber.ref(fiber.stateNode);
        }
      } else {
        if (isMarkMount(fiber)) {
          placementFiber(fiber, true);
          dispatchHook(fiber, "onMounted", true);
        }
        if (isMarkUpdate(fiber)) {
          if (!isMarkMount(fiber)) {
            dispatchHook(fiber, "onBeforeUpdate");
          }
          dispatchHook(fiber, "onUpdated", true);
        }
        if (isMarkMoved(fiber)) {
          placementFiber(fiber, false);
          dispatchHook(fiber, "onBeforeMove");
          dispatchHook(fiber, "onMoved", true);
        }
        if (isMarkRef(fiber)) {
          fiber.ref(fiber);
        }
      }

      fiber.needRender = false;
      fiber.flags = NoFlags;
    }
  };

  const toCommit = (renderContext) => {
    commitRoot(renderContext);
    NoEqualPropMap.clear();

    if (renderContext.restoreDataFn) {
      return renderContext.restoreDataFn;
    }
  };

  const innerRender = (renderContext) => {
    const obj = renderContext.gen.next();
    const current = obj.value;

    if (obj.done) {
      return toCommit.bind(null, renderContext);
    }

    print("count", "Generator Fiber Count");

    if (current.flags !== NoFlags) {
      renderContext.MutationQueue.push(current);
    } else {
      current.flags = NoFlags;
      current.needRender = false;
    }

    return true;
  };

  const createRoot = (container) => {
    const fiberType = container.tagName.toLowerCase();
    const fiberNodeKey = `${fiberType}#${
      container.id || (Date.now() + Math.random()).toString(36)
    }`;

    Object.keys(eventTypeMap).forEach((eventType) =>
      initEvent(container, eventType)
    );

    return {
      render(jsx) {
        const rootFiber = createFiber(
          { type: fiberType, props: { children: jsx } },
          fiberNodeKey
        );

        rootFiber.stateNode = container;
        container.__rootFiber = rootFiber;
        rootFiber.rerender();
      },
    };
  };

  exports.jsx = jsx;
  exports.Fragment = Fragment;
  exports.objectEqual = objectEqual;
  exports.useReducer = useReducer;
  exports.useRef = useRef;
  exports.useState = useState;
  exports.createContext = createContext;
  exports.useContext = useContext;
  exports.useEffect = useEffect;
  exports.useSyncExternalStore = useSyncExternalStore;
  exports.useFiber = useFiber;
  exports.createRoot = createRoot;
});
