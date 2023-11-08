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
  });

  const Fragment = (props = {}) => props.children;

  const isArray = (val) => Array.isArray(val);
  const isString = (val) => typeof val === "string";
  const isObject = (val) => val !== null && typeof val === "object";
  const isFunction = (val) => typeof val === "function";

  const objectEqual = (object1, object2, isDeep) => {
    if (object1 === object2) {
      return true;
    }

    if (
      typeof object1 !== "object" ||
      typeof object2 !== "object" ||
      object1 === null ||
      object2 === null
    ) {
      return false;
    }

    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      const o1 = object1[key];
      const o2 = object2[key];

      if (isDeep) {
        if (!objectEqual(o1, o2, true)) {
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

  const isSpecialBooleanAttr = (val) =>
    ({
      itemscope: true,
      allowfullscreen: true,
      formnovalidate: true,
      ismap: true,
      nomodule: true,
      novalidate: true,
      readonly: true,
    }[val]);

  const includeBooleanAttr = (value) => !!value || value === "";

  const uniqueSet = new Set();
  const queueMicrotaskOnce = (func) => {
    if (!uniqueSet.has(func)) {
      uniqueSet.add(func);

      queueMicrotask(() => {
        func();
        uniqueSet.delete(func);
      });
    }
  };

  const genQueueMacrotask = (macrotaskName) => {
    const frameYieldMs = 10;
    const scheduledQueue = [];
    const channel = new MessageChannel();

    let isLoopRunning = false;

    channel.port1.onmessage = () => {
      if (!scheduledQueue.length) {
        isLoopRunning = false;
        return;
      }

      let next = null;
      const startTime = Date.now();
      const timeoutTime = startTime + frameYieldMs;
      const deadline = {
        get didTimeout() {
          return Date.now() > timeoutTime;
        },
      };

      // console.count(macrotaskName);

      try {
        do {
          const work = scheduledQueue.shift();
          next = work(deadline);
        } while (!next && scheduledQueue.length && !deadline.didTimeout);
      } finally {
        if (isFunction(next)) {
          scheduledQueue.unshift(next);
        }

        if (scheduledQueue.length) {
          schedulePerform();
        } else {
          isLoopRunning = false;
        }
      }
    };

    const schedulePerform = () => channel.port2.postMessage(null);

    return (task) => {
      if (scheduledQueue.includes(task)) {
        return;
      }
      scheduledQueue.push(task);

      if (!isLoopRunning) {
        isLoopRunning = true;
        schedulePerform();
      }
    };
  };

  const mainQueueMacrotask = genQueueMacrotask("main-macro-task");

  const effectQueueMacrotask = genQueueMacrotask("effect-macro-task");

  const elementPropsKey = "__props";

  /* #region 事件相关 */

  const eventTypeMap = {
    click: ["onClickCapture", "onClick"],
    dblclick: ["onDblclickCapture", "onDblclick"],
    mousedown: ["onMousedownCapture", "onMousedown"],
    mouseup: ["onMouseupCapture", "onMouseup"],
    mousemove: ["onMousemoveCapture", "onMousemove"],
    keydown: ["onKeydownCapture", "onKeydown"],
    keyup: ["onKeyupCapture", "onKeyup"],
    keypress: ["onKeypressCapture", "onKeypress"],
    submit: ["onSubmitCapture", "onSubmit"],
    touchstart: ["onTouchstartCapture", "onTouchstart"],
    touchend: ["onTouchendCapture", "onTouchend"],
    touchmove: ["onTouchmoveCapture", "onTouchmove"],
  };

  const collectPaths = (targetElement, container, eventType) => {
    const paths = {
      capture: [],
      bubble: [],
    };

    while (targetElement && targetElement !== container) {
      const callbackNameList = eventTypeMap[eventType];
      const elementProps = targetElement[elementPropsKey];

      if (elementProps && callbackNameList) {
        const [captureName, bubbleName] = callbackNameList;
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
    const syntheticEvent = createSyntheticEvent(e);

    triggerEventFlow(capture, syntheticEvent);

    if (!syntheticEvent.__stopPropagation) {
      triggerEventFlow(bubble, syntheticEvent);
    }
  };

  const initEvent = (container, eventType) => {
    container.addEventListener(eventType, (e) => {
      dispatchEvent(container, eventType, e);
    });
  };

  const testHostSpecialAttr = (name) => /^on[A-Z]/.test(name);
  const hostSpecialAttrSet = new Set([
    "onLoad",
    "onBeforeunload",
    "onUnload",
    "onScroll",
    "onFocus",
    "onBlur",
    "onPointerenter",
    "onPointerleave",
    "onInput",
  ]);

  const onCompositionStart = (e) => {
    e.target.composing = true;
  };
  const onCompositionEnd = (e) => {
    const target = e.target;
    if (target.composing) {
      target.composing = false;
      target.dispatchEvent(new Event("input"));
    }
  };
  const onInputFixed = (e) => {
    if (!e.target.composing) {
      e.target[elementPropsKey]["onInput"](e);
    }
  };
  const eventCallback = (e) => {
    const pKey = `on${e.type[0].toUpperCase()}${e.type.slice(1)}`;
    if (e.target[elementPropsKey][pKey]) {
      e.target[elementPropsKey][pKey](e);
    }
  };

  const normalizeClass = (value) => {
    let res = "";
    if (isString(value)) {
      res = value;
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const normalized = normalizeClass(value[i]);
        if (normalized) {
          res += normalized + " ";
        }
      }
    } else if (isObject(value)) {
      for (const name in value) {
        if (value[name]) {
          res += name + " ";
        }
      }
    }
    return res.trim();
  };

  const listDelimiterRE = /;(?![^(]*\))/g;
  const propertyDelimiterRE = /:([^]+)/;
  const styleCommentRE = /\/\*[^]*?\*\//g;
  const parseStringStyle = (cssText) => {
    return cssText
      .replace(styleCommentRE, "")
      .split(listDelimiterRE)
      .reduce((acc, item) => {
        if (item) {
          const tmp = item.split(propertyDelimiterRE);
          if (tmp.length > 1) {
            acc[tmp[0].trim()] = tmp[1].trim();
          }
        }
        return acc;
      }, {});
  };

  const normalizeStyle = (value) => {
    if (isArray(value)) {
      const res = {};
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const normalized = isString(item)
          ? parseStringStyle(item)
          : normalizeStyle(item);

        if (normalized) {
          for (const key in normalized) {
            res[key] = normalized[key];
          }
        }
      }
      return res;
    } else if (isString(value)) {
      return value;
    } else if (isObject(value)) {
      return value;
    }
  };

  const camelizeRE = /-(\w)/g;
  const camelizePlacer = (_, c) => (c ? c.toUpperCase() : "");
  const camelize = (str) => {
    return str.replace(camelizeRE, camelizePlacer);
  };

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
    fixAttrName(key) {
      return (
        {
          className: "class",
          htmlFor: "for",
        }[key] || key
      );
    },
    createInstance(type) {
      return document.createElement(type);
    },
    createTextInstance(content) {
      return document.createTextNode(content);
    },
    toLast(child, container) {
      container.appendChild(child);
    },
    toFirst(child, container) {
      container.insertBefore(child, container.firstChild);
    },
    toBefore(child, container, reference) {
      container.insertBefore(child, reference);
    },
    toAfter(child, container, reference) {
      container.insertBefore(child, reference.nextSibling);
    },
    removeChild(child) {
      child.parentNode.removeChild(child);
    },
    commitTextUpdate(node, content) {
      node.nodeValue = content;
    },
    commitInstanceUpdate(node, attrs) {
      for (let i = 0; i < attrs.length; i += 2) {
        const pKey = attrs[i];
        const pValue = attrs[i + 1];

        if (hostSpecialAttrSet.has(pKey)) {
          domHostConfig.fixHostSpecial(node, pKey, pValue);
        } else {
          const attrName = hostConfig.fixAttrName(pKey);
          if (pValue === void 0) {
            node.removeAttribute(attrName);
          } else {
            switch (attrName) {
              case "class":
                node.className = normalizeClass(pValue);
                break;
              case "style":
                const styleValue = normalizeStyle(pValue);
                if (isString(styleValue)) {
                  node.style.cssText = styleValue;
                } else {
                  for (const key in styleValue) {
                    setStyle(node.style, key, styleValue[key]);
                  }
                }
                break;
              default:
                node.setAttribute(attrName, pValue);
            }
          }
        }
      }
    },
    fixHostSpecial(node, fullEventName, callback) {
      const eventName = fullEventName.slice(2).toLowerCase();
      const method =
        callback === void 0 ? "removeEventListener" : "addEventListener";

      if (eventName === "input") {
        node[method]("compositionstart", onCompositionStart);
        node[method]("compositionend", onCompositionEnd);
        node[method]("change", onCompositionEnd);
        node[method]("input", onInputFixed);
      } else {
        node[method](eventName, eventCallback);
      }
    },
    updateInstanceProps(node, props) {
      node[elementPropsKey] = props;
    },
    genRestoreDataFn() {
      const focusedElement = document.activeElement;
      const start = focusedElement.selectionStart;
      const end = focusedElement.selectionEnd;

      // 重新定位焦点, 恢复选择位置
      return () => {
        focusedElement.focus();
        focusedElement.selectionStart = start;
        focusedElement.selectionEnd = end;
      };
    },
  };

  /* #region-end 事件相关 */

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
        fiber.memoizedState.forEach(markUpdate);
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

  const runner = (fiber, hookName) => {
    for (const hook of fiber[hookName]) {
      const destroy = hook(fiber);

      if (isFunction(destroy)) {
        const cleanName =
          {
            onBeforeMove: "onMoved",
            onMounted: "onUnMounted",
            onUpdated: "onBeforeUpdate",
          }[hookName] || "__None__";

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
    // console.log(`dispatch Component-${hookName}`, fiber.nodeKey);

    if (fiber[hookName] && fiber[hookName].size) {
      if (async) {
        effectQueueMacrotask(() => runner(fiber, hookName));
      } else {
        runner(fiber, hookName);
      }
    }
  };

  const toElement = (item) => {
    if (typeof item === "string" || typeof item === "number") {
      return jsx("text", { content: item });
    } else if (isArray(item)) {
      return jsx(Fragment, { children: item });
    } else if (!item || !item.type) {
      return jsx("text", { content: "" });
    } else {
      return item;
    }
  };

  const NoFlags = 0b0000000;
  const Placement = 0b0000001;
  const Update = 0b0000010;
  const ChildDeletion = 0b0000100;
  const MarkRef = 0b001000;

  const markUpdate = (fiber) => {
    fiber.flags |= Update;
  };
  const markPlacement = (fiber) => {
    fiber.flags |= Placement;
  };
  const markRef = (fiber) => {
    fiber.flags |= MarkRef;
  };
  const markChildDeletion = (fiber) => {
    fiber.flags |= ChildDeletion;
  };
  const inheritPlacement = (fiber, reference) => {
    fiber.flags |= reference.flags & Placement;
  };

  const NewFiber = 0b0000001;
  const ReuseFiber = 0b0000010;
  const RetainFiber = 0b00000100;

  const FunctionComponent = 0b0000001;
  const HostComponent = 0b0000010;
  const HostText = 0b00000100;

  class Fiber {
    key = null;
    ref = null;
    type = null;
    tag = null;
    pNodeKey = "";
    nodeKey = "";
    pendingProps = {};
    memoizedProps = {};
    memoizedState = null;
    __StateIndex = 0;
    updateQueue = [];

    index = -1;
    oldIndex = -1;
    __refer = null;
    stateNode = null;

    root = null;
    child = null;
    return = null;
    sibling = null;
    deletionMap = null;

    flags = NoFlags;
    reuseFlag = NewFiber;

    get normalChildren() {
      if (this.tag === HostText) {
        return [];
      }

      let tempChildren =
        this.tag === HostComponent
          ? this.pendingProps.children
          : genComponentInnerElement(this);

      if (tempChildren === void 0) {
        return [];
      } else {
        return isArray(tempChildren)
          ? tempChildren.map(toElement)
          : [toElement(tempChildren)];
      }
    }

    get isSelfStateChange() {
      return (this.flags & Update) !== NoFlags;
    }

    constructor(element, key, pNodeKey, nodeKey) {
      this.key = key;
      this.pNodeKey = pNodeKey;
      this.nodeKey = nodeKey;
      this.type = element.type;
      this.pendingProps = element.props;
      this.flags = Placement;

      if (isString(this.type)) {
        if (this.type === "text") {
          this.tag = HostText;
          this.stateNode = hostConfig.createTextInstance(
            this.pendingProps.content
          );
        } else {
          this.tag = HostComponent;
          this.stateNode = hostConfig.createInstance(this.type);
        }

        this.stateNode.__fiber = this;
      } else {
        this.tag = FunctionComponent;
      }
    }

    isDescendantOf(returnFiber) {
      return !!findParentFiber(this, (f) => f === returnFiber);
    }

    rerender() {
      if (Fiber.scheduler || !Fiber.ExistPool.has(this.nodeKey)) {
        return;
      }

      if (this.tag === FunctionComponent) {
        Fiber.RerenderSet.add(this);
        mainQueueMacrotask(batchRerender);
      } else {
        Fiber.scheduler = {
          preHostFiber: null,
          MutationQueue: [],
          gen: genFiberTree(this),
          next: (deadline) => innerRender(deadline, this),
          restoreDataFn: hostConfig.genRestoreDataFn(),
        };

        mainQueueMacrotask(Fiber.scheduler.next);
      }
    }
  }

  Fiber.ExistPool = new Map();
  Fiber.RerenderSet = new Set();
  Fiber.genNodeKey = (key, pNodeKey = "") => pNodeKey + "^" + key;
  Fiber.isPortal = (fiber) => !!fiber.pendingProps.__target;
  Fiber.clean = (fiber) => {
    fiber.reuseFlag = RetainFiber;
    fiber.deletionMap = null;
    fiber.flags = NoFlags;
    fiber.__refer = null;
  };
  Fiber.initLifecycle = (fiber) => {
    fiber.onMounted = new Set();
    fiber.onUnMounted = new Set();
    fiber.onUpdated = new Set();
    fiber.onBeforeUpdate = new Set();
    fiber.onBeforeMove = new Set();
    fiber.onMoved = new Set();
  };

  const checkSelfStateChange = (f) => f.isSelfStateChange;

  const isContainerFiber = (fiber) =>
    fiber.tag === HostComponent || Fiber.isPortal(fiber);

  const batchRerender = () => {
    const mapFiberCount = new Map();
    let commonReturnHost = null;

    label: for (const current of Fiber.RerenderSet) {
      current.updateQueue.forEach((fn) => fn());
      current.updateQueue.length = 0;
      markUpdate(current);
      let fiber = current;
      while (fiber) {
        if (isContainerFiber(fiber)) {
          const preCount = mapFiberCount.get(fiber) || 0;
          const curCount = preCount + 1;

          if (curCount >= Fiber.RerenderSet.size) {
            commonReturnHost = fiber;
            break label;
          } else {
            mapFiberCount.set(fiber, curCount);
          }
        }
        fiber = fiber.return;
      }
    }

    Fiber.RerenderSet.clear();
    if (commonReturnHost) {
      commonReturnHost.rerender();
    }
  };

  function* walkChildFiber(returnFiber) {
    let fiber = returnFiber.child;
    while (fiber) {
      yield fiber;
      fiber = fiber.sibling;
    }
  }

  function* walkFiberTree(returnFiber) {
    let fiber = returnFiber.child;
    while (fiber) {
      yield* walkFiberTree(fiber);
      fiber = fiber.sibling;
    }
    yield returnFiber;
  }

  const createFiber = (element, key, pNodeKey = "") => {
    const nodeKey = Fiber.genNodeKey(key, pNodeKey);
    let fiber = Fiber.ExistPool.get(nodeKey);

    if (fiber) {
      fiber.pendingProps = element.props;
      fiber.flags &= Update;
      fiber.reuseFlag = ReuseFiber;

      fiber.sibling = null;
      fiber.return = null;
    } else {
      fiber = new Fiber(element, key, pNodeKey, nodeKey);
      Fiber.ExistPool.set(nodeKey, fiber);
    }

    return fiber;
  };

  const findParentFiber = (fiber, checker, includeCurrent) => {
    let current = includeCurrent ? fiber : fiber.return;
    while (current) {
      if (checker(current)) {
        return current;
      }
      current = current.return;
    }
  };

  const beginWork = (returnFiber) => {
    const grandpa = returnFiber.return;
    if (grandpa && grandpa.tag === FunctionComponent) {
      inheritPlacement(returnFiber, grandpa);
    }

    if (
      returnFiber.reuseFlag !== NewFiber &&
      !returnFiber.isSelfStateChange &&
      objectEqual(returnFiber.pendingProps, returnFiber.memoizedProps, true)
    ) {
      return;
    }

    const children = returnFiber.normalChildren;

    const oldFiberMap = new Map();
    // child 还保留着旧子fiber的引用，用来收集 deletionMap
    for (const child of walkChildFiber(returnFiber)) {
      oldFiberMap.set(child.nodeKey, child);
    }
    returnFiber.child = null;

    let preFiber = null;
    let preOldIndex = -1;
    for (let index = 0; index < children.length; index++) {
      const element = children[index];
      const key = `${element.type.name || element.type}#${
        element.key || index
      }`;
      const fiber = createFiber(element, key, returnFiber.nodeKey);
      fiber.root = returnFiber.root;
      fiber.index = index;
      fiber.return = returnFiber;
      oldFiberMap.delete(fiber.nodeKey);

      if (
        fiber.oldIndex === -1 ||
        fiber.oldIndex <= preOldIndex ||
        fiber.memoizedProps.__target !== fiber.pendingProps.__target
      ) {
        markPlacement(fiber);
      } else {
        preOldIndex = fiber.oldIndex;
      }

      if (index === 0) {
        returnFiber.child = fiber;
      } else {
        preFiber.sibling = fiber;
      }

      fiber.oldIndex = fiber.index;
      preFiber = fiber;
    }

    if (oldFiberMap.size) {
      returnFiber.deletionMap = oldFiberMap;
      markChildDeletion(returnFiber);
    }
  };

  const finishedWork = (fiber) => {
    if (
      fiber.reuseFlag !== RetainFiber &&
      findParentFiber(fiber, checkSelfStateChange, true)
    ) {
      const oldProps = { ...(fiber.memoizedProps || {}) };
      const newProps = fiber.pendingProps || {};

      if (oldProps.ref !== newProps.ref) {
        const oldRef = oldProps.ref;
        const newRef = newProps.ref;

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

      if (fiber.tag === HostText) {
        if (!oldProps || newProps.content !== oldProps.content) {
          fiber.memoizedState = newProps.content;
          markUpdate(fiber);
        }
      } else if (fiber.tag === HostComponent) {
        const attrs = [];

        for (const [pKey, pValue] of Object.entries(newProps)) {
          const oldPValue = oldProps[pKey];
          delete oldProps[pKey];

          if (
            pKey === "children" ||
            pKey === "ref" ||
            pKey[0] === "_" ||
            pValue === oldPValue
          ) {
            continue;
          }

          if (testHostSpecialAttr(pKey)) {
            if (hostSpecialAttrSet.has(pKey)) {
              attrs.push(pKey, pValue);
            }
          } else {
            const isBoolean = isSpecialBooleanAttr(pKey);
            if (pValue == null || (isBoolean && !includeBooleanAttr(pValue))) {
              attrs.push(pKey, void 0);
            } else {
              attrs.push(pKey, isBoolean ? "" : pValue);
            }
          }
        }

        for (const [pKey] of Object.entries(oldProps)) {
          if (pKey === "children" || pKey === "ref" || pKey[0] === "_") {
            continue;
          }

          if (testHostSpecialAttr(pKey)) {
            if (hostSpecialAttrSet.has(pKey)) {
              attrs.push(pKey, void 0);
            }
          } else {
            attrs.push(pKey, void 0);
          }
        }

        fiber.memoizedState = attrs;
        if (fiber.memoizedState.length) {
          markUpdate(fiber);
        }
      } else {
        if (
          fiber.reuseFlag !== NewFiber &&
          !objectEqual(fiber.memoizedProps, fiber.pendingProps)
        ) {
          markUpdate(fiber);
        }
      }
    }

    fiber.memoizedProps = fiber.pendingProps;
    // 事件变动了，没有记录flag, 需要更新存储
    if (fiber.tag === HostComponent) {
      hostConfig.updateInstanceProps(fiber.stateNode, fiber.memoizedProps);
    }
  };

  function* genFiberTree(returnFiber) {
    beginWork(returnFiber);

    let isLeaf = true;
    let fiber = returnFiber.child;

    while (fiber) {
      isLeaf = false;
      yield* genFiberTree(fiber);
      fiber = fiber.sibling;
    }

    yield [returnFiber, isLeaf];
  }

  const placementFiber = (fiber) => {
    const parentHostFiber = findParentFiber(fiber, isContainerFiber);

    if (!parentHostFiber) {
      return;
    }

    // 它是一个 portal: 用带有 __target 指向的 stateNode
    if (Fiber.isPortal(parentHostFiber)) {
      hostConfig.toLast(fiber.stateNode, parentHostFiber.pendingProps.__target);
      return;
    }

    const preHostFiber = fiber.__refer;

    if (preHostFiber && preHostFiber.isDescendantOf(parentHostFiber)) {
      hostConfig.toAfter(
        fiber.stateNode,
        parentHostFiber.stateNode,
        preHostFiber.stateNode
      );
    } else {
      hostConfig.toFirst(fiber.stateNode, parentHostFiber.stateNode);
    }
  };

  const updateHostFiber = (fiber) => {
    if (fiber.tag === HostText) {
      hostConfig.commitTextUpdate(fiber.stateNode, fiber.memoizedState);
    } else {
      hostConfig.commitInstanceUpdate(fiber.stateNode, fiber.memoizedState);
    }
  };

  const childDeletionFiber = (returnFiber) => {
    for (const fiber of returnFiber.deletionMap.values()) {
      for (const f of walkFiberTree(fiber)) {
        if (f.tag !== FunctionComponent) {
          hostConfig.removeChild(f.stateNode);
        } else {
          dispatchHook(f, "onUnMounted", true);
        }

        f.ref && f.ref(null);
        Fiber.ExistPool.delete(f.nodeKey);
      }
    }
    returnFiber.deletionMap = null;
  };

  const commitRoot = (mutationList = []) => {
    console.log("mutationList: " + mutationList.length);
    for (const fiber of mutationList) {
      const isHostFiber = fiber.tag !== FunctionComponent;

      if ((fiber.flags & ChildDeletion) !== NoFlags) {
        childDeletionFiber(fiber);
        fiber.flags &= ~ChildDeletion;
      }

      if ((fiber.flags & Update) !== NoFlags) {
        if (isHostFiber) {
          updateHostFiber(fiber);
        } else {
          dispatchHook(fiber, "onBeforeUpdate");
          dispatchHook(fiber, "onUpdated", true);
        }
        fiber.flags &= ~Update;
      }

      if ((fiber.flags & Placement) !== NoFlags) {
        if (isHostFiber) {
          placementFiber(fiber);
        } else {
          if (fiber.reuseFlag !== NewFiber) {
            dispatchHook(fiber, "onBeforeMove");
            dispatchHook(fiber, "onMoved", true);
          } else {
            dispatchHook(fiber, "onMounted", true);
            dispatchHook(fiber, "onUpdated", true);
          }
        }

        fiber.flags &= ~Placement;
      }

      if ((fiber.flags & MarkRef) !== NoFlags) {
        if (isHostFiber) {
          fiber.ref(fiber.stateNode);
        } else {
          fiber.ref(fiber);
        }

        fiber.flags &= ~MarkRef;
      }

      Fiber.clean(fiber);
    }
  };

  const markPreHostRefer = (leafChild, preHostFiber) => {
    let current = leafChild;
    while (
      current.return &&
      !current.return.__refer &&
      current === current.return.child
    ) {
      current.return.__refer = preHostFiber;
      current = current.return;
    }
  };

  const innerRender = (deadline) => {
    const scheduler = Fiber.scheduler;
    let obj = null;

    do {
      obj = scheduler.gen.next();

      if (obj.done) {
        return () => {
          commitRoot(scheduler.MutationQueue);

          if (scheduler.restoreDataFn) {
            scheduler.restoreDataFn();
          }

          Fiber.scheduler = null;
        };
      }

      const [fiber, isLeaf] = obj.value;
      finishedWork(fiber);

      if (isLeaf) {
        fiber.__refer = scheduler.preHostFiber;
        markPreHostRefer(fiber, scheduler.preHostFiber);
      }

      if (fiber.flags !== NoFlags) {
        scheduler.MutationQueue.push(fiber);
      } else {
        Fiber.clean(fiber);
      }

      if (
        fiber.tag !== FunctionComponent &&
        !findParentFiber(fiber, Fiber.isPortal, true)
      ) {
        scheduler.preHostFiber = fiber;
      }

      if (deadline.didTimeout) {
        return scheduler.next;
      }
    } while (!obj.done);
  };

  const createRoot = (container) => {
    const key = container.id || (Date.now() + Math.random()).toString(36);

    Object.keys(eventTypeMap).forEach((eventType) => {
      initEvent(container, eventType);
    });

    return {
      render(element) {
        const rootFiber = createFiber(
          {
            type: container.tagName.toLowerCase(),
            props: { children: element },
          },
          key
        );
        rootFiber.stateNode = container;
        rootFiber.root = rootFiber;
        markUpdate(rootFiber);
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
