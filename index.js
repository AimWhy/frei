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

  const SpecialBooleanAttr = new Set([
    "itemscope",
    "allowfullscreen",
    "formnovalidate",
    "ismap",
    "nomodule",
    "novalidate",
    "readonly",
  ]);
  const isSpecialBooleanAttr = (val) => SpecialBooleanAttr.has(val);

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
    const pKey = "on" + e.type[0].toUpperCase() + e.type.slice(1);
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
    return res;
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
    attrMap: {
      className: "class",
      htmlFor: "for",
    },
    fixAttrName(key) {
      return this.attrMap[key] || key;
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
      if (child.isConnected) {
        child.parentNode.removeChild(child);
      }
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
        fiber.memoizedState.forEach((f) => {
          f.stateFlag = SelfStateChange;
        });
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
    if (item && itemType === "object" && item.type) {
      return item;
    } else if (itemType === "string" || itemType === "number") {
      return jsx("text", { content: item });
    } else if (isArray(item)) {
      return jsx(Fragment, { children: item });
    } else {
      return jsx("text", { content: "" });
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

  const NewFiber = Symbol("NewFiber");
  const ReuseFiber = Symbol("ReuseFiber");
  const RetainFiber = Symbol("RetainFiber");

  const HostText = Symbol("HostText");
  const HostComponent = Symbol("HostComponent");
  const FunctionComponent = Symbol("FunctionComponent");

  const NoPortal = Symbol("NoPortal");
  const IsPortal = Symbol("IsPortal");
  const InPortal = Symbol("InPortal");

  const NoStateChange = Symbol("NoStateChange");
  const SelfStateChange = Symbol("SelfStateChange");
  const ReturnStateChange = Symbol("ReturnStateChange");

  class Fiber {
    key = null;
    ref = null;
    type = null;
    tagType = null;
    pNodeKey = "";
    nodeKey = "";
    pendingProps = {};
    memoizedProps = {};
    memoizedState = null;
    __StateIndex = 0;
    updateQueue = null;

    index = -1;
    oldIndex = -1;
    __refer = null;
    stateNode = null;

    root = null;
    child = null;
    return = null;
    sibling = null;
    deletionSet = null;

    flags = NoFlags;
    reuseFlag = NewFiber;
    portalFlag = NoPortal;
    stateFlag = NoStateChange;

    get normalChildren() {
      if (this.tagType === HostText) {
        return null;
      }

      let tempChildren =
        this.tagType === HostComponent
          ? this.pendingProps.children
          : genComponentInnerElement(this);

      if (tempChildren === void 0) {
        return null;
      } else {
        return isArray(tempChildren)
          ? tempChildren.map(toElement)
          : [toElement(tempChildren)];
      }
    }

    constructor(element, key, pNodeKey, nodeKey) {
      this.key = key;
      this.pNodeKey = pNodeKey;
      this.nodeKey = nodeKey;
      this.type = element.type;
      this.pendingProps = element.props;
      this.flags = Placement;

      if (this.type === "text") {
        this.tagType = HostText;
        this.memoizedProps = this.pendingProps;
        this.stateNode = hostConfig.createTextInstance(
          this.pendingProps.content
        );
      } else if (isString(this.type)) {
        this.tagType = HostComponent;
        this.stateNode = hostConfig.createInstance(this.type);
      } else {
        this.tagType = FunctionComponent;
      }
    }

    isDescendantOf(returnFiber) {
      return !!findParentFiber(this, (f) => f === returnFiber);
    }

    rerender() {
      if (Fiber.scheduler || !Fiber.ExistPool.has(this.nodeKey)) {
        return;
      }

      if (this.tagType === FunctionComponent) {
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

  Fiber.clean = (fiber, isCommit) => {
    fiber.reuseFlag = RetainFiber;
    fiber.flags = NoFlags;
    fiber.__refer = null;
    fiber.stateFlag = NoStateChange;

    // 事件变动了，没有记录flag, 需要更新存储
    if (fiber.tagType === HostComponent) {
      hostConfig.updateInstanceProps(fiber.stateNode, fiber.memoizedProps);
    }
  };
  Fiber.initLifecycle = (fiber) => {
    fiber.onMounted = new Set();
    fiber.onUnMounted = new Set();
    fiber.onUpdated = new Set();
    fiber.onBeforeUpdate = new Set();
    fiber.onBeforeMove = new Set();
    fiber.onMoved = new Set();
  };

  const isContainerFiber = (fiber) =>
    fiber.tagType === HostComponent || fiber.portalFlag === IsPortal;

  const batchRerender = () => {
    const mapFiberCount = new Map();
    let commonReturnHost = null;

    label: for (const current of Fiber.RerenderSet) {
      current.updateQueue.forEach((fn) => fn());
      current.updateQueue.length = 0;
      current.stateFlag = SelfStateChange;
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
      fiber.flags = NoFlags;
      fiber.reuseFlag = ReuseFiber;

      fiber.sibling = null;
      fiber.return = null;
    } else {
      fiber = new Fiber(element, key, pNodeKey, nodeKey);
      Fiber.ExistPool.set(nodeKey, fiber);
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

  const beginWork = (returnFiber) => {
    if (
      returnFiber.reuseFlag !== NewFiber &&
      returnFiber.stateFlag !== SelfStateChange &&
      objectEqual(returnFiber.pendingProps, returnFiber.memoizedProps, true)
    ) {
      return;
    }

    const children = returnFiber.normalChildren;

    // child 还保留着旧子fiber的引用，用来收集 deletionSet
    const deletionSet = returnFiber.deletionSet || new Set();
    for (const child of walkChildFiber(returnFiber)) {
      deletionSet.add(child);
    }
    returnFiber.child = null;

    if (children !== null) {
      let preFiber = null;
      let preOldIndex = -1;
      for (let index = 0; index < children.length; index++) {
        const element = children[index];
        const key =
          (isString(element.type) ? element.type : element.type.name) +
          "#" +
          (element.key != null ? element.key : index);
        const fiber = createFiber(element, key, returnFiber.nodeKey);
        fiber.index = index;
        fiber.return = returnFiber;
        deletionSet.delete(fiber);

        if (
          fiber.oldIndex === -1 ||
          fiber.oldIndex <= preOldIndex ||
          fiber.memoizedProps.__target !== fiber.pendingProps.__target
        ) {
          markPlacement(fiber);
        } else {
          preOldIndex = fiber.oldIndex;
        }

        fiber.portalFlag = fiber.pendingProps.__target ? IsPortal : NoPortal;

        if (index === 0) {
          returnFiber.child = fiber;
        } else {
          preFiber.sibling = fiber;
        }

        fiber.oldIndex = fiber.index;
        preFiber = fiber;
      }
    }

    if (deletionSet.size) {
      returnFiber.deletionSet = deletionSet;
      markChildDeletion(returnFiber);
    }
  };

  const finishedWork = (fiber) => {
    if (fiber.reuseFlag !== RetainFiber && fiber.stateFlag !== NoStateChange) {
      const oldProps = fiber.memoizedProps || {};
      const newProps = fiber.pendingProps || {};
      let isChange = false;

      if (oldProps.ref !== newProps.ref) {
        const oldRef = oldProps.ref;
        const newRef = newProps.ref;

        isChange = true;

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

      if (fiber.stateFlag === SelfStateChange) {
        markUpdate(fiber);
      }

      if (fiber.tagType === HostText) {
        if (!oldProps || newProps.content !== oldProps.content) {
          fiber.memoizedState = newProps.content;
          markUpdate(fiber);
        }
      } else if (fiber.tagType === HostComponent) {
        const attrs = [];
        const SkipSymbol = Symbol("skip");

        for (const pKey in newProps) {
          const pValue = newProps[pKey];
          let oldPValue = void 0;

          if (pKey in oldProps) {
            oldPValue = oldProps[pKey];
            oldProps[pKey] = SkipSymbol;
          }

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

        for (const pKey in oldProps) {
          if (
            pKey === "children" ||
            pKey === "ref" ||
            pKey[0] === "_" ||
            oldProps[pKey] === SkipSymbol
          ) {
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
          isChange ||
          (fiber.reuseFlag !== NewFiber &&
            !objectEqual(fiber.memoizedProps, fiber.pendingProps))
        ) {
          markUpdate(fiber);
        }
      }
    }

    fiber.memoizedProps = fiber.pendingProps;
  };

  function* genFiberTree(returnFiber) {
    beginWork(returnFiber);

    let isLeaf = true;
    let fiber = returnFiber.child;

    while (fiber) {
      isLeaf = false;
      fiber.root = returnFiber.root;

      if (returnFiber.tagType === FunctionComponent) {
        inheritPlacement(fiber, returnFiber);
      }

      if (
        returnFiber.portalFlag !== NoPortal &&
        fiber.portalFlag === NoPortal
      ) {
        fiber.portalFlag = InPortal;
      }

      if (
        returnFiber.stateFlag !== NoStateChange &&
        fiber.stateFlag === NoStateChange
      ) {
        fiber.stateFlag = ReturnStateChange;
      }

      if (fiber.tagType === HostText) {
        yield [fiber, true];
      } else {
        yield* genFiberTree(fiber);
      }

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
    if (parentHostFiber.portalFlag === IsPortal) {
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
    if (fiber.tagType === HostText) {
      hostConfig.commitTextUpdate(fiber.stateNode, fiber.memoizedState);
    } else {
      hostConfig.commitInstanceUpdate(fiber.stateNode, fiber.memoizedState);
    }
  };

  const childDeletionFiber = (returnFiber) => {
    for (const fiber of returnFiber.deletionSet) {
      for (const f of walkFiberTree(fiber)) {
        if (f.tagType !== FunctionComponent) {
          hostConfig.removeChild(f.stateNode);
        } else {
          dispatchHook(f, "onUnMounted", true);
        }

        f.ref && f.ref(null);
        Fiber.ExistPool.delete(f.nodeKey);
      }
    }
    returnFiber.deletionSet.clear();
  };

  const commitRoot = () => {
    for (const fiber of Fiber.scheduler.MutationQueue) {
      const isHostFiber = fiber.tagType !== FunctionComponent;

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

      Fiber.clean(fiber, true);
    }
  };

  const markPreHostRefer = (leafChild) => {
    let current = leafChild;
    const preHostFiber = leafChild.__refer;
    while (
      current.return &&
      !current.return.__refer &&
      current === current.return.child
    ) {
      current.return.__refer = preHostFiber;
      current = current.return;
      if (current.portalFlag === IsPortal) {
        return;
      }
    }
  };

  const innerRender = (deadline) => {
    const scheduler = Fiber.scheduler;
    let obj = null;

    do {
      obj = scheduler.gen.next();

      if (obj.done) {
        return () => {
          commitRoot();

          if (scheduler.restoreDataFn) {
            scheduler.restoreDataFn();
          }

          Fiber.scheduler = null;
        };
      }

      const [fiber, isLeaf] = obj.value;

      finishedWork(fiber);

      const portalParent =
        fiber.portalFlag === InPortal
          ? findParentFiber(fiber, (f) => f.portalFlag === IsPortal)
          : null;

      if (isLeaf) {
        fiber.__refer = !portalParent
          ? scheduler.preHostFiber
          : portalParent.__preHostFiber;
        markPreHostRefer(fiber);
      }

      if (fiber.flags !== NoFlags) {
        scheduler.MutationQueue.push(fiber);
      } else {
        Fiber.clean(fiber, false);
      }

      if (fiber.tagType !== FunctionComponent) {
        if (!portalParent) {
          scheduler.preHostFiber = fiber;
        } else {
          portalParent.__preHostFiber = fiber;
        }
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
        container.__rootFiber = rootFiber;
        rootFiber.root = rootFiber;
        rootFiber.stateFlag = SelfStateChange;
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
