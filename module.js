export const jsx = (type, props = {}, key = null) => ({
  key,
  type,
  props,
});

export const Fragment = (props) => props.children;

const noop = () => {};
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

    const startTime = Date.now();
    const timeoutTime = startTime + frameYieldMs;
    const didTimeout = () => Date.now() > timeoutTime;

    try {
      while (scheduledQueue.length > 0 && !didTimeout()) {
        const work = scheduledQueue[scheduledQueue.length - 1];
        const next = work();

        if (isFunction(next)) {
          scheduledQueue[scheduledQueue.length - 1] = next;
        } else {
          scheduledQueue.length -= 1;
        }
      }
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
    if (!scheduledQueue.includes(task)) {
      scheduledQueue.unshift(task);

      if (!isLoopRunning) {
        isLoopRunning = true;
        schedulePerform();
      }
    }
  };
};

const mainQueueMacrotask = genQueueMacrotask("main-macro-task");

const effectQueueMacrotask = genQueueMacrotask("effect-macro-task");

const elementPropsKey = "__fiber";

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
    const elementProps = e.target[elementPropsKey].memoizedProps;
    elementProps["onInput"](e);
  }
};
const eventCallback = (e) => {
  const pKey = "on" + e.type[0].toUpperCase() + e.type.slice(1);
  const elementProps = e.target[elementPropsKey]
    ? e.target[elementPropsKey].memoizedProps
    : null;
  if (elementProps && elementProps[pKey]) {
    elementProps[pKey](e);
  }
};

const camelizePlacer = (_, c) => (c ? c.toUpperCase() : "");
const camelize = (str) => {
  return str.replace(/-(\w)/g, camelizePlacer);
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
    return domHostConfig.attrMap[key] || key;
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
    child[elementPropsKey] = null;
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
      fiber.memoizedState.forEach((f) => {
        f.preStateFlag |= SelfStateChange;
        findParentFiber(f, (item) => {
          item.preStateFlag |= ChildStateChange;
          return item === fiber;
        });
      });
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
const MarkMount = 1 << 0;
const MarkMoved = 1 << 1;
const ChildDeletion = 1 << 2;
const MarkUpdate = 1 << 3;
const MarkRef = 1 << 4;

const markUpdate = (fiber) => {
  fiber.flags |= MarkUpdate;
};
const markMount = (fiber) => {
  fiber.flags |= MarkMount;
};
const markMoved = (fiber) => {
  fiber.flags |= MarkMoved;
};
const markRef = (fiber) => {
  fiber.flags |= MarkRef;
};
const markChildDeletion = (fiber) => {
  fiber.flags |= ChildDeletion;
};

const HostText = Symbol("HostText");
const HostComponent = Symbol("HostComponent");
const FunctionComponent = Symbol("FunctionComponent");

const NoPortal = 0 << 0;
const SelfPortal = 1 << 0;
const ReturnPortal = 1 << 1;

const NoStateChange = 0 << 0;
const SelfStateChange = 1 << 0;
const ChildStateChange = 1 << 1;

class Fiber {
  key = null;
  ref = null;
  type = null;
  tagType = null;
  nodeKey = "";
  pendingProps = {};
  memoizedProps = {};
  memoizedState = null;
  __StateIndex = 0;
  updateQueue = null;

  index = -1;
  oldIndex = -1;
  __refer = null;
  __deletion = null;
  stateNode = null;

  child = null;
  return = null;
  sibling = null;

  flags = MarkMount;
  portalFlag = NoPortal;
  preStateFlag = SelfStateChange;

  get normalChildren() {
    if (this.tagType === HostText) {
      return null;
    }

    const tempChildren =
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
    }
  }

  rerender() {
    if (Fiber.scheduler) {
      return;
    }

    if (!isContainerFiber(this)) {
      Fiber.RerenderSet.add(this);
      mainQueueMacrotask(batchRerender);
    } else {
      Fiber.scheduler = {
        preHostFiber: null,
        MutationQueue: [],
        gen: genFiberTree(this),
        restoreDataFn: hostConfig.genRestoreDataFn(),
      };
      mainQueueMacrotask(innerRender);
    }
  }
}

Fiber.RerenderSet = new Set();
Fiber.genNodeKey = (key, pNodeKey = "") => pNodeKey + "^" + key;

Fiber.initLifecycle = (fiber) => {
  fiber.onMounted = new Set();
  fiber.onUnMounted = new Set();
  fiber.onUpdated = new Set();
  fiber.onBeforeUpdate = new Set();
  fiber.onBeforeMove = new Set();
  fiber.onMoved = new Set();
};

const isPortal = (f) => f.portalFlag & SelfPortal;
const isHostFiber = (f) => f.tagType === HostComponent;
const isContainerFiber = (f) => isHostFiber(f) || isPortal(f);
const isDescendantOf = (fiber, returnFiber) =>
  findParentFiber(fiber, (f) => f === returnFiber);

const runUpdate = (fn) => fn();
const batchRerender = () => {
  const mapFiberCount = new Map();
  let commonReturnHost = null;
  let fiber = null;

  label: for (const current of Fiber.RerenderSet) {
    current.updateQueue.forEach(runUpdate);
    current.updateQueue.length = 0;
    current.preStateFlag |= SelfStateChange;

    fiber = current;
    while (fiber) {
      if (isContainerFiber(fiber)) {
        const preCount = mapFiberCount.get(fiber) || 0;

        if (preCount + 1 >= Fiber.RerenderSet.size) {
          commonReturnHost = fiber;
          break label;
        } else {
          mapFiberCount.set(fiber, preCount + 1);
        }
      }

      fiber = fiber.return;

      if (fiber) {
        fiber.preStateFlag |= ChildStateChange;
      }
    }
  }

  Fiber.RerenderSet.clear();

  if (commonReturnHost) {
    findParentFiber(commonReturnHost, (f) => {
      f.preStateFlag &= ~ChildStateChange;
    });
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
  let fiber = deletionMap.size ? deletionMap.get(nodeKey) : null;

  if (fiber) {
    fiber.pendingProps = element.props;
    fiber.sibling = null;
    fiber.return = null;
    fiber.__skip = false;
    fiber.__lastDirty = false;

    if (
      !(fiber.preStateFlag & SelfStateChange) &&
      !objectEqual(fiber.pendingProps, fiber.memoizedProps, true)
    ) {
      fiber.preStateFlag |= SelfStateChange;
    }
  } else {
    fiber = new Fiber(element, key, nodeKey);
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
const isSkipFiber = (f) => !f.flags && !f.preStateFlag;
const beginWork = (returnFiber) => {
  if (!returnFiber.preStateFlag) {
    return;
  }

  const deletionMap = new Map();
  for (const oldFiber of walkChildFiber(returnFiber)) {
    deletionMap.set(oldFiber.nodeKey, oldFiber);
  }
  returnFiber.child = null;

  const increasing = deletionMap.size ? [] : null;
  const deletionKey = deletionMap.size ? [] : null;
  let indexCount = [];
  let j = 0;

  const children = returnFiber.normalChildren;
  if (children !== null) {
    let preFiber = null;

    for (let index = 0; index < children.length; index++) {
      const element = children[index];
      const key =
        (isString(element.type) ? element.type : element.type.name) +
        "#" +
        (element.key != null ? element.key : index);
      const nodeKey = Fiber.genNodeKey(key, returnFiber.nodeKey);
      const fiber = createFiber(element, key, nodeKey, deletionMap);
      fiber.index = index;
      fiber.return = returnFiber;

      if (fiber.oldIndex === -1) {
        markMount(fiber);
      } else {
        if (!fiber.memoizedProps.__target && !fiber.pendingProps.__target) {
          markMoved(fiber);
          deletionKey.push(nodeKey);

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
            markMoved(fiber);
          }
          deletionMap.delete(nodeKey);
        }
      }

      if (index === 0) {
        returnFiber.child = fiber;
      } else {
        preFiber.sibling = fiber;
      }

      preFiber = fiber;
    }
  }

  if (deletionMap.size || (increasing && increasing.length)) {
    // increasing 不一定是正确的最长递增序列，中间有些数有可能被替换了
    // 所以需要再走一遍构建 increasing 的逻辑
    let max = Math.max(...indexCount);
    for (let i = deletionKey.length - 1; max > 0; i--) {
      if (indexCount[i] === max) {
        increasing[max - 1] = deletionKey[i];
        max--;
      }
    }

    if (increasing) {
      for (const anchor of increasing) {
        deletionMap.get(anchor).flags &= ~MarkMoved;
      }
    }

    if (!(returnFiber.flags & MarkMount)) {
      let lastDirtyFiber;
      let preFiber;
      for (const f of walkChildFiber(returnFiber)) {
        if (!lastDirtyFiber || f.flags || f.preStateFlag) {
          lastDirtyFiber = f;
        }

        if (
          preFiber &&
          isSkipFiber(preFiber) &&
          isSkipFiber(f) &&
          !isPortal(f)
        ) {
          preFiber.__skip = true;
        }
        preFiber = f;
      }

      if (lastDirtyFiber) {
        lastDirtyFiber.__lastDirty = true;
      }
    }

    for (const k of deletionKey) {
      deletionMap.delete(k);
    }

    if (deletionMap.size) {
      returnFiber.__deletion = deletionMap;
      markChildDeletion(returnFiber);
    }
  }
};

const finishedWork = (fiber) => {
  if (isSkipFiber(fiber)) {
    fiber.memoizedProps = fiber.pendingProps;
  } else {
    const oldProps = fiber.memoizedProps || {};
    const newProps = fiber.pendingProps || {};

    let isMarkUpdate = false;

    if (oldProps.ref !== newProps.ref) {
      const oldRef = oldProps.ref;
      const newRef = newProps.ref;

      isMarkUpdate = true;

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
        isMarkUpdate = true;
      }
    } else if (fiber.tagType === HostComponent) {
      const attrs = [];
      const skip = Object.create(null);

      for (const pKey in newProps) {
        const pValue = newProps[pKey];
        let oldPValue = void 0;

        if (pKey in oldProps) {
          oldPValue = oldProps[pKey];
          skip[pKey] = true;
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
          skip[pKey]
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
        isMarkUpdate = true;
      }
    } else {
      if (!(fiber.flags & MarkMount) && fiber.preStateFlag & SelfStateChange) {
        isMarkUpdate = true;
      }
    }

    if (isMarkUpdate) {
      markUpdate(fiber);
    }
    fiber.memoizedProps = fiber.pendingProps;
  }
};

const markPortal = (fiber, returnFiber) => {
  if (returnFiber.portalFlag) {
    fiber.portalFlag |= ReturnPortal;
  }
};

function* genFiberTree(returnFiber) {
  returnFiber.__refer = null;
  returnFiber.portalFlag = NoPortal;

  beginWork(returnFiber);

  returnFiber.portalFlag = returnFiber.pendingProps.__target
    ? SelfPortal
    : NoPortal;

  let isCleanFiber = true;
  let fiber = returnFiber.child;

  while (fiber) {
    fiber.oldIndex = fiber.index;
    isCleanFiber = false;

    if (
      returnFiber.tagType === FunctionComponent &&
      returnFiber.flags & MarkMoved
    ) {
      markMoved(fiber);
    }

    markPortal(fiber, returnFiber);

    if (fiber.__skip) {
      fiber = fiber.sibling;
      continue;
    }

    if (fiber.tagType === HostText) {
      yield [fiber, true];
    } else if (isSkipFiber(fiber)) {
      yield [fiber, true];
    } else {
      yield* genFiberTree(fiber);
    }

    if (fiber.__lastDirty) {
      break;
    }

    fiber = fiber.sibling;
  }

  yield [returnFiber, isCleanFiber];
}

const placementFiber = (fiber) => {
  const parentHostFiber = findParentFiber(fiber, isContainerFiber);

  if (!parentHostFiber) {
    return;
  }

  // 它是一个 portal: 用带有 __target 指向的 stateNode
  if (isPortal(parentHostFiber)) {
    hostConfig.toLast(fiber.stateNode, parentHostFiber.pendingProps.__target);
    return;
  }

  const preHostFiber = fiber.__refer;

  if (preHostFiber && isDescendantOf(preHostFiber, parentHostFiber)) {
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
  for (const fiber of returnFiber.__deletion.values()) {
    for (const f of walkFiberTree(fiber)) {
      if (f.tagType !== FunctionComponent) {
        hostConfig.removeChild(f.stateNode);
      } else {
        dispatchHook(f, "onUnMounted", true);
      }

      f.ref && f.ref(null);
    }
  }
  returnFiber.__deletion = null;
};

const commitRoot = () => {
  for (const fiber of Fiber.scheduler.MutationQueue) {
    const isHostFiber = fiber.tagType !== FunctionComponent;

    if (fiber.flags & ChildDeletion) {
      childDeletionFiber(fiber);
      fiber.flags &= ~ChildDeletion;
    }

    if (fiber.flags & MarkUpdate) {
      if (isHostFiber) {
        updateHostFiber(fiber);
      } else {
        dispatchHook(fiber, "onBeforeUpdate");
        dispatchHook(fiber, "onUpdated", true);
      }
      fiber.flags &= ~MarkUpdate;
    }

    if (fiber.flags & MarkMount) {
      if (isHostFiber) {
        placementFiber(fiber);
      } else {
        dispatchHook(fiber, "onMounted", true);
        dispatchHook(fiber, "onUpdated", true);
      }

      fiber.flags &= ~MarkMount;
    }

    if (fiber.flags & MarkMoved) {
      if (isHostFiber) {
        placementFiber(fiber);
      } else {
        dispatchHook(fiber, "onBeforeMove");
        dispatchHook(fiber, "onMoved", true);
      }
      fiber.flags &= ~MarkMoved;
    }

    if (fiber.flags & MarkRef) {
      if (isHostFiber) {
        fiber.ref(fiber.stateNode);
      } else {
        fiber.ref(fiber);
      }

      fiber.flags &= ~MarkRef;
    }

    fiber.preStateFlag = NoStateChange;
    fiber.flags = NoFlags;
  }
};

const findLastRefer = (returnFiber) => {
  const queue = [returnFiber];
  while (queue.length) {
    const current = queue.pop();
    if (current.tagType !== FunctionComponent) {
      return current;
    }

    for (const fiber of walkChildFiber(current)) {
      if (!isPortal(fiber)) {
        queue.push(fiber);
      }
    }
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

    if (isPortal(current)) {
      return;
    }
  }
};

const toCommit = () => {
  commitRoot();
  if (Fiber.scheduler.restoreDataFn) {
    Fiber.scheduler.restoreDataFn();
  }
  Fiber.scheduler = null;
};

const innerRender = () => {
  const obj = Fiber.scheduler.gen.next();

  if (obj.done) {
    return toCommit;
  }

  const [current, isCleanFiber] = obj.value;

  finishedWork(current);

  if (!isPortal(current)) {
    const portalParent =
      current.portalFlag & ReturnPortal
        ? findParentFiber(current, isPortal)
        : null;

    if (!current.child || isCleanFiber) {
      if (!portalParent) {
        current.__refer = Fiber.scheduler.preHostFiber;
      } else {
        current.__refer = portalParent.__preHostFiber;
      }
      markPreHostRefer(current);
    }

    let referFiber = null;
    if (current.tagType !== FunctionComponent) {
      referFiber = current;
    } else if (isCleanFiber) {
      referFiber = findLastRefer(current);
    }

    if (referFiber) {
      if (!portalParent) {
        Fiber.scheduler.preHostFiber = referFiber;
      } else {
        portalParent.__preHostFiber = referFiber;
      }
    }
  }

  if (current.flags) {
    Fiber.scheduler.MutationQueue.push(current);
  } else {
    current.flags = NoFlags;
    current.preStateFlag = NoStateChange;
  }

  return innerRender;
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
        key,
        new Map()
      );

      rootFiber.stateNode = container;
      rootFiber.stateNode.__rootFiber = rootFiber;
      rootFiber.rerender();
    },
  };
};
