export const jsx = (type, props = {}, key = null) => ({
  key,
  type,
  props,
});

export const Fragment = (props) => props.children;

const noop = (_) => _;
const isArray = (val) => Array.isArray(val);
const isString = (val) => typeof val === "string";
const isFunction = (val) => typeof val === "function";

export const objectEqual = (object1, object2, isDeep) => {
  if (object1 === object2) {
    return true;
  }

  if (
    object1 === null ||
    object2 === null ||
    typeof object1 !== "object" ||
    typeof object2 !== "object"
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
  val === "allowfullscreen" ||
  val === "formnovalidate" ||
  val === "novalidate" ||
  val === "itemscope" ||
  val === "nomodule" ||
  val === "readonly" ||
  val === "ismap";

const includeBooleanAttr = (value) => value === "" || !!value;

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

    let throttleTimes = 0;
    const startTime = Date.now();
    const timeoutTime = startTime + frameYieldMs;

    try {
      while (
        scheduledQueue.length > 0 &&
        (throttleTimes !== 0 || Date.now() <= timeoutTime)
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
        throttleTimes = (throttleTimes + 1) % 40;
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

const elementPropsKey = Symbol("__fiber");

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
    const elementProps = targetElement[elementPropsKey]
      ? targetElement[elementPropsKey].memoizedProps
      : null;

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

  const { bubble, capture } = collectPaths(targetElement, container, eventType);
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
  if (e.target.composing) {
    e.target.composing = false;
    e.target.dispatchEvent(new Event("input"));
  }
};
const onInputFixed = (e) => {
  if (!e.target.composing) {
    const elementProps = e.target[elementPropsKey]
      ? e.target[elementPropsKey].memoizedProps
      : null;
    if (elementProps && elementProps.onInput) {
      elementProps.onInput(e);
    }
  }
};
const eventCallback = (e) => {
  const pKey = `on${e.type[0].toUpperCase()}${e.type.slice(1)}`;
  const elementProps = e.target[elementPropsKey]
    ? e.target[elementPropsKey].memoizedProps
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
  toLast(child, container) {
    if (isVNode(container)) {
      const parentNode = container.endNode.parentNode;

      if (isVNode(child)) {
        parentNode.insertBefore(child.toFragment(), container.endNode);
      } else {
        parentNode.insertBefore(child, container.endNode);
      }
    } else {
      if (isVNode(child)) {
        container.appendChild(child.toFragment());
      } else {
        container.appendChild(child);
      }
    }
  },
  toFirst(child, container) {
    if (isVNode(container)) {
      const referenceNode = container.startNode.nextSibling;
      const parentNode = container.endNode.parentNode;

      if (isVNode(child)) {
        parentNode.insertBefore(child.toFragment(), referenceNode);
      } else {
        parentNode.insertBefore(child, referenceNode);
      }
    } else {
      if (isVNode(child)) {
        container.prepend(child.toFragment());
      } else {
        container.prepend(child);
      }
    }
  },
  toAfter(child, container, reference) {
    let referenceNode = isVNode(reference)
      ? reference.endNode.nextSibling
      : reference.nextSibling;

    if (isVNode(container)) {
      const parentNode = container.endNode.parentNode;

      if (isVNode(child)) {
        parentNode.insertBefore(child.toFragment(), referenceNode);
      } else {
        parentNode.insertBefore(child, referenceNode);
      }
    } else {
      if (isVNode(child)) {
        container.insertBefore(child.toFragment(), referenceNode);
      } else {
        container.insertBefore(child, referenceNode);
      }
    }
  },
  removeChild(child) {
    if (isVNode(child)) {
      const startNode = child.startNode;
      const endNode = child.endNode;
      while (startNode.nextSibling !== endNode) {
        startNode.parentNode.removeChild(startNode.nextSibling);
      }
      startNode.parentNode.removeChild(startNode);
      endNode.parentNode.removeChild(endNode);
    } else {
      child.parentNode.removeChild(child);
      child[elementPropsKey] = null;
    }
  },
  commitTextUpdate(node, content) {
    node.nodeValue = content;
  },
  commitInstanceUpdate(node, attrsMap) {
    for (let [pKey, pValue] of attrsMap.entries()) {
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
        const styleValue = pValue;

        if (isString(styleValue)) {
          node.style.cssText = styleValue;
        } else {
          for (const key in styleValue) {
            setStyle(node.style, key, styleValue[key]);
          }
        }
      } else {
        node.setAttribute(attrName, pValue);
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
  updateInstanceProps(node, fiber) {
    node[elementPropsKey] = fiber;
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

const isVNode = (o) => o.constructor === VNode;

class VNode {
  constructor(key) {
    this.fg = domHostConfig.createFragment();
    this.startNode = domHostConfig.createComment(`start:${key}`);
    this.endNode = domHostConfig.createComment(`end:${key}`);
    this.fg.appendChild(this.startNode);
    this.fg.appendChild(this.endNode);
  }
  toFragment() {
    // 非首次渲染时
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
}

/* #region-end 事件相关 */

const hostConfig = domHostConfig;

let workInProgress = null;
export const useFiber = (isInitHook) => {
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

export const useReducer = (reducer, initialState) => {
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

export const useRef = (initialValue) => {
  const fiber = useFiber(true);
  const innerIndex = fiber.__StateIndex++;
  const { hookQueue } = fiber;

  if (hookQueue.length <= innerIndex) {
    hookQueue[innerIndex] = { current: initialValue };
  }

  return hookQueue[innerIndex];
};

export const useState = (initialState) => {
  return useReducer((state, action) => {
    return isFunction(action) ? action(state) : action;
  }, initialState);
};

export const createContext = (initialState) => {
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

export const useContext = (context) => {
  const fiber = useFiber();
  const checkProvider = (f) => f.type === context.Provider;
  const providerFiber = findParentFiber(fiber, checkProvider);
  providerFiber.memoizedState.add(fiber);

  return providerFiber.pendingProps.value;
};

export const useEffect = (func, dep) => {
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
export const useSyncExternalStore = (subscribe, getSnapshot) => {
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

const NoFlags = 0 << 0;
const MountFlag = 1 << 0;
const MovedFlag = 1 << 1;
const ChildDeletionFlag = 1 << 2;
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
const unMarkUpdate = (fiber) => {
  fiber.flags &= ~UpdateFlag;
};
const isMarkUpdate = (fiber) => fiber.flags & UpdateFlag;
const markMount = (fiber, preFiber) => {
  fiber.flags |= MountFlag;
  fiber.preReferFiber = preFiber;
};
const unMarkMount = (fiber) => {
  fiber.flags &= ~MountFlag;
  fiber.preReferFiber = null;
};
const isMarkMount = (fiber) => fiber.flags & MountFlag;
const markMoved = (fiber, preFiber) => {
  fiber.flags |= MovedFlag;
  fiber.preReferFiber = preFiber;
};
const unMarkMoved = (fiber) => {
  fiber.flags &= ~MovedFlag;
  fiber.preReferFiber = null;
};
const isMarkMoved = (fiber) => fiber.flags & MovedFlag;
const markRef = (fiber) => {
  fiber.flags |= RefFlag;
};
const unMarkRef = (fiber) => {
  fiber.flags &= ~RefFlag;
};
const isMarkRef = (fiber) => fiber.flags & RefFlag;
const markChildDeletion = (fiber) => {
  fiber.flags |= ChildDeletionFlag;
};
const unMarkChildDeletion = (fiber) => {
  fiber.flags &= ~ChildDeletionFlag;
};
const isMarkChildDeletion = (fiber) => fiber.flags & ChildDeletionFlag;

const HostText = Symbol("HostText");
const HostComponent = Symbol("HostComponent");
const FunctionComponent = Symbol("FunctionComponent");

const resolvedPromise = Promise.resolve();
const EmptyProps = {};
class Fiber {
  key = null;
  ref = null;
  type = null;
  tagType = null;
  nodeKey = "";
  pendingProps = EmptyProps;
  memoizedProps = EmptyProps;
  memoizedState = null;
  __StateIndex = 0;
  updateQueue = null;

  index = -1;
  oldIndex = -1;
  __deletion = null;
  stateNode = null;
  preReferFiber = null;

  child = null;
  return = null;
  sibling = null;

  flags = MountFlag;
  isPortal = false;
  needRender = true;

  get normalChildren() {
    if (this.tagType === HostText) {
      return null;
    }

    const tempChildren =
      this.tagType === HostComponent
        ? this.pendingProps.children
        : genComponentInnerElement(this);

    if (tempChildren == void 0) {
      return null;
    } else {
      return isArray(tempChildren)
        ? tempChildren.map(toElement)
        : [toElement(tempChildren)];
    }
  }

  constructor(element, key, nodeKey) {
    this.key = key;
    this.nodeKey = nodeKey;
    this.type = element.type;
    this.pendingProps = element.props;

    if (this.type === "text") {
      this.tagType = HostText;
      this.memoizedProps = this.pendingProps;
      this.stateNode = hostConfig.createTextInstance(this.pendingProps.content);
    } else if (isString(this.type)) {
      this.tagType = HostComponent;
      this.stateNode = hostConfig.createInstance(this.type);
      hostConfig.updateInstanceProps(this.stateNode, this);
    } else {
      this.tagType = FunctionComponent;
      this.stateNode = new VNode(this.nodeKey);
    }
  }

  rerender() {
    if (!this.lock) {
      this.lock = true;
      resolvedPromise.then(() => {
        this.lock = false;
      });
      mainQueueMacrotask(incomingQueue.bind(null, this));
    }
  }
}

Fiber.genNodeKey = (key, pNodeKey = "") => `${pNodeKey}^${key}`;

Fiber.initLifecycle = (fiber) => {
  fiber.onMounted = new Set();
  fiber.onUnMounted = new Set();
  fiber.onUpdated = new Set();
  fiber.onBeforeUpdate = new Set();
  fiber.onBeforeMove = new Set();
  fiber.onMoved = new Set();
};

const runUpdate = (fn) => fn();
const incomingQueue = (fiber) => {
  if (!isMarkUnMount(fiber)) {
    if (fiber.updateQueue) {
      fiber.updateQueue.forEach(runUpdate);
      fiber.updateQueue.length = 0;
    }

    fiber.needRender = true;
    markUpdate(fiber);

    const renderContext = {
      MutationQueue: [],
      gen: genFiberTree(fiber),
      restoreDataFn: hostConfig.genRestoreDataFn(),
    };

    return innerRender.bind(null, renderContext);
  }
};

function* walkChildFiber(returnFiber) {
  let fiber = returnFiber.child;
  while (fiber) {
    yield fiber;
    fiber = fiber.sibling;
  }
}

function* walkFiberTree(returnFiber, fn = noop) {
  let fiber = returnFiber.child;
  while (fiber) {
    fn(fiber, returnFiber);
    yield* walkFiberTree(fiber);
    fiber = fiber.sibling;
  }
  yield returnFiber;
}

const createFiber = (element, key, nodeKey, deletionMap) => {
  let fiber = deletionMap ? deletionMap.get(nodeKey) : null;

  if (fiber) {
    fiber.pendingProps = element.props;
    fiber.sibling = null;
    fiber.return = null;
    fiber.__skip = false;
    fiber.__lastDirty = false;
    fiber.oldIndex = fiber.index;
    fiber.needRender = finishedWork(fiber, false) !== NoUpdateFlag;
  } else {
    fiber = new Fiber(element, key, nodeKey);
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

const findIndex = (nodeKeyArr, fiber, fiberMap) => {
  let i = 0;
  let j = nodeKeyArr.length;
  while (i !== j) {
    const mid = Math.floor((i + j) / 2);
    const tempFiber = fiberMap.get(nodeKeyArr[mid]);
    if (tempFiber.oldIndex < fiber.oldIndex) {
      i = mid + 1;
    } else {
      j = mid;
    }
  }
  return i;
};

const isSkipFiber = (f) => !f.needRender && f.flags === NoFlags;

const beginWork = (returnFiber) => {
  if (!returnFiber.needRender) {
    return;
  }

  let deletionMap = null;
  let hasOldChildFiber = false;
  if (!isMarkMount(returnFiber) && returnFiber.child) {
    deletionMap = new Map();
    hasOldChildFiber = true;
    for (const oldFiber of walkChildFiber(returnFiber)) {
      deletionMap.set(oldFiber.nodeKey, oldFiber);
    }
  }

  returnFiber.child = null;

  const reuseKeyList = hasOldChildFiber ? [] : null;
  const increasing = hasOldChildFiber ? [] : null;
  const indexCount = hasOldChildFiber ? [] : null;

  let j = 0;
  let lastDirtyFiber = null;
  const children = returnFiber.normalChildren;

  if (children != null) {
    let preFiber = null;
    let noPortalPreFiber = null;

    for (let index = 0; index < children.length; index++) {
      const element = children[index];
      const key = `${
        isString(element.type) ? element.type : element.type.name
      }#${element.key != null ? element.key : index}`;
      const nodeKey = Fiber.genNodeKey(key, returnFiber.nodeKey);
      const fiber = createFiber(element, key, nodeKey, deletionMap);
      fiber.index = index;
      fiber.return = returnFiber;
      fiber.isPortal = !!fiber.pendingProps.__target;

      if (fiber.oldIndex === -1) {
        markMount(fiber, noPortalPreFiber);
        lastDirtyFiber = fiber;
      } else if (hasOldChildFiber) {
        if (!fiber.memoizedProps.__target && !fiber.pendingProps.__target) {
          markMoved(fiber, noPortalPreFiber);
          // 记录复用的 nodeKey，循环结束后再从 deletionMap 中移除
          reuseKeyList.push(nodeKey);

          const i = findIndex(increasing, fiber, deletionMap);
          if (i + 1 > increasing.length) {
            increasing.push(nodeKey);
            indexCount[j++] = increasing.length;
          } else {
            increasing[i] = nodeKey;
            indexCount[j++] = i + 1;
          }
        } else {
          if (fiber.memoizedProps.__target !== fiber.pendingProps.__target) {
            markMoved(fiber, noPortalPreFiber);
            lastDirtyFiber = fiber;
          } else if (!isSkipFiber(fiber)) {
            lastDirtyFiber = fiber;
          }

          // 从待删除 deletionMap 中移除此 nodeKey
          deletionMap.delete(nodeKey);
        }
      }

      if (index === 0) {
        lastDirtyFiber = fiber;
        returnFiber.child = fiber;
      } else {
        preFiber.sibling = fiber;
      }

      preFiber = fiber;
      if (!fiber.isPortal) {
        noPortalPreFiber = fiber;
      }
      fiber.memoizedProps = fiber.pendingProps;
    }
  }

  // increasing 不一定是正确的最长递增序列，中间有些数有可能被替换了
  // 所以需要再走一遍构建 increasing 的逻辑
  if (hasOldChildFiber) {
    let max = Math.max(...indexCount);

    for (let i = reuseKeyList.length - 1; i > -1; i--) {
      const fiberKey = reuseKeyList[i];
      const fiber = deletionMap.get(fiberKey);

      // 位置复用
      if (max > 0 && indexCount[i] === max) {
        increasing[max - 1] = fiberKey;
        // 属于递增子序列里，取消标记位移
        unMarkMoved(fiber);
        max--;
      }

      // 这里只考虑在 returnFiber 内部是否可以跳过
      if (isSkipFiber(fiber)) {
        fiber.__skip = true;
      } else {
        if (!lastDirtyFiber || fiber.index >= lastDirtyFiber.index) {
          lastDirtyFiber = fiber;
        }
      }
    }
  }

  if (lastDirtyFiber) {
    lastDirtyFiber.__lastDirty = true;
  }

  if (hasOldChildFiber) {
    for (const k of reuseKeyList) {
      deletionMap.delete(k);
    }

    if (deletionMap.size) {
      returnFiber.__deletion = deletionMap;
      markChildDeletion(returnFiber);
    }
  }
};

const NoUpdateFlag = 0 << 0;
const SelfUpdateFlag = 1 << 0;
const SubTreeUpdateFlag = 1 << 1;

const SkipEventFunc = noop;
const fillNewAttrMap = (attrMap, props) => {
  for (const pKey in props) {
    let pValue = props[pKey];

    if (pKey === "children" || pKey === "ref" || pKey[0] === "_") {
      continue;
    }

    if (testHostSpecialAttr(pKey)) {
      if (hostSpecialAttrSet.has(pKey)) {
        attrMap.set(pKey, pValue);
      } else {
        attrMap.set(pKey, SkipEventFunc);
      }
      continue;
    }

    const isBooleanAttr = isSpecialBooleanAttr(pKey);
    if (pValue == null || (isBooleanAttr && !includeBooleanAttr(pValue))) {
      pValue = void 0;
    } else {
      pValue = isBooleanAttr ? "" : pValue;
    }
    attrMap.set(pKey, props[pKey]);
  }
};

const finishedWork = (fiber, isMount) => {
  const oldProps = fiber.memoizedProps;
  const newProps = fiber.pendingProps;

  let result = NoUpdateFlag;
  let isNeedMarkUpdate = false;

  const oldRef = oldProps.ref;
  const newRef = newProps.ref;
  if (oldRef !== newRef) {
    isNeedMarkUpdate = true;

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

  if (fiber.tagType === HostText) {
    if (!oldProps || newProps.content !== oldProps.content) {
      fiber.memoizedState = newProps.content;
      isNeedMarkUpdate = true;
    }
  } else if (fiber.tagType === HostComponent) {
    if (fiber.memoizedState) {
      fiber.memoizedState.clear();
    } else {
      fiber.memoizedState = new Map();
    }

    const newAttrMap = fiber.memoizedState;
    fillNewAttrMap(newAttrMap, newProps);

    if (!isMount) {
      for (const pKey in oldProps) {
        if (pKey === "children" || pKey === "ref" || pKey[0] === "_") {
          continue;
        }

        if (newAttrMap.has(pKey)) {
          const oldPValue = oldProps[pKey];
          const newPValue = newAttrMap.get(pKey);

          if (testHostSpecialAttr(pKey)) {
            if (isFunction(newPValue) ^ isFunction(oldPValue)) {
              newAttrMap.set(pKey, isFunction(newPValue) ? newPValue : void 0);
            } else {
              newAttrMap.delete(pKey);
            }
          } else {
            if (objectEqual(newPValue, oldPValue, true)) {
              newAttrMap.delete(pKey);
            }
          }
          continue;
        }

        newAttrMap.delete(pKey);
      }
    }

    if (fiber.memoizedState.size) {
      isNeedMarkUpdate = true;
    }

    if (isMount || !objectEqual(oldProps.children, newProps.children, true)) {
      result |= SubTreeUpdateFlag;
    }
  } else {
    if (
      !isMount &&
      (fiber.needRender || !objectEqual(oldProps, newProps, true))
    ) {
      isNeedMarkUpdate = true;
    }
  }

  if (isNeedMarkUpdate) {
    markUpdate(fiber);
    result |= SelfUpdateFlag;
  }

  return result;
};

function* genFiberTree(returnFiber) {
  beginWork(returnFiber);

  let fiber = returnFiber.child;

  while (fiber) {
    if (fiber.__skip) {
      // 跳过不处理
    } else if (fiber.tagType === HostText) {
      yield fiber;
    } else if (isSkipFiber(fiber)) {
      yield fiber;
    } else {
      yield* genFiberTree(fiber);
    }

    if (fiber.__lastDirty) {
      break;
    }

    fiber = fiber.sibling;
  }

  yield returnFiber;
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

  if (fiber.preReferFiber) {
    hostConfig.toAfter(
      fiber.stateNode,
      parentFiber.stateNode,
      fiber.preReferFiber.stateNode
    );
  } else {
    hostConfig.toFirst(fiber.stateNode, parentFiber.stateNode);
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
  for (const fiber of returnFiber.__deletion.values()) {
    hostConfig.removeChild(fiber.stateNode);

    for (const f of walkFiberTree(fiber)) {
      markUnMount(f);

      if (f.tagType === FunctionComponent) {
        dispatchHook(f, "onUnMounted", true);
      }

      f.ref && f.ref(null);
      f.stateNode = null;
    }
  }
  returnFiber.__deletion = null;
};

const commitRoot = (renderContext) => {
  for (const fiber of renderContext.MutationQueue) {
    const isHostFiber = fiber.tagType !== FunctionComponent;

    if (isMarkChildDeletion(fiber)) {
      childDeletionFiber(fiber);
      unMarkChildDeletion(fiber);
    }

    if (isMarkUpdate(fiber)) {
      if (isHostFiber) {
        updateHostFiber(fiber);
      } else {
        dispatchHook(fiber, "onBeforeUpdate");
        dispatchHook(fiber, "onUpdated", true);
      }
      unMarkUpdate(fiber);
    }

    if (isMarkMount(fiber)) {
      placementFiber(fiber, true);
      if (!isHostFiber) {
        dispatchHook(fiber, "onMounted", true);
        dispatchHook(fiber, "onUpdated", true);
      }
      unMarkMount(fiber);
    }

    if (isMarkMoved(fiber)) {
      placementFiber(fiber, false);

      if (!isHostFiber) {
        dispatchHook(fiber, "onBeforeMove");
        dispatchHook(fiber, "onMoved", true);
      }
      unMarkMoved(fiber);
    }

    if (isMarkRef(fiber)) {
      if (isHostFiber) {
        fiber.ref(fiber.stateNode);
      } else {
        fiber.ref(fiber);
      }
      unMarkRef(fiber);
    }

    fiber.needRender = false;
    fiber.flags = NoFlags;
  }
};

const toCommit = (renderContext) => {
  commitRoot(renderContext);

  if (renderContext.restoreDataFn) {
    renderContext.restoreDataFn();
  }
};

const innerRender = (renderContext) => {
  const obj = renderContext.gen.next();
  const current = obj.value;

  if (obj.done) {
    return toCommit.bind(null, renderContext);
  }

  if (current.flags !== NoFlags) {
    renderContext.MutationQueue.push(current);
  } else {
    current.flags = NoFlags;
    current.needRender = false;
  }

  return true;
};

export const createRoot = (container) => {
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
        key,
        key
      );

      rootFiber.stateNode = container;
      container.__rootFiber = rootFiber;
      rootFiber.rerender();
    },
  };
};
