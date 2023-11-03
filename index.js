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

  const NoFlags = 0b0000000;
  const Placement = 0b0000001;
  const Update = 0b0000010;
  const ChildDeletion = 0b0000100;
  const MarkRef = 0b001000;
  const MarkReusableFiber = 0b010000;

  const checkTrue = () => true;
  const makeMap = (list) => {
    const memo = new Set(list);
    return (val) => memo.has(val);
  };

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

  const isSpecialBooleanAttr = makeMap([
    "itemscope",
    "allowfullscreen",
    "formnovalidate",
    "ismap",
    "nomodule",
    "novalidate",
    "readonly",
  ]);
  const includeBooleanAttr = (value) => !!value || value === "";

  const HTML_TAGS =
    "html,body,base,head,link,meta,style,title,address,article,aside,footer,header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,summary,template,blockquote,iframe,tfoot".split(
      ","
    );
  const isHTMLTag = makeMap(HTML_TAGS);

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
    const frameYieldMs = 8;
    const scheduledQueue = [];
    const channel = new MessageChannel();

    let isLoopRunning = false;

    channel.port1.onmessage = function performWork() {
      if (!scheduledQueue.length) {
        isLoopRunning = false;
        return;
      }

      let next;
      const startTime = performance.now();
      const deadline = {
        get didTimeout() {
          return performance.now() - startTime > frameYieldMs;
        },
      };

      console.count(macrotaskName);

      try {
        do {
          const work = scheduledQueue.shift();
          next = work(deadline);
        } while (!deadline.didTimeout && scheduledQueue.length);
      } finally {
        if (typeof next === "function") {
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
      scheduledQueue.push(task);
      if (!isLoopRunning) {
        isLoopRunning = true;
        schedulePerform();
      }
    };
  };

  const queueMacrotask = genQueueMacrotask("main-macro-task");

  const otherQueueMacrotask = genQueueMacrotask("other-macro-task");

  const elementPropsKey = "__props";

  /* #region 事件相关 */

  const eventTypeMap = {
    click: ["onClickCapture", "onClick"],
  };

  function collectPaths(targetElement, container, eventType) {
    const paths = {
      capture: [],
      bubble: [],
    };

    while (targetElement && targetElement !== container) {
      const callbackNameList = eventTypeMap[eventType];
      const elementProps = targetElement[elementPropsKey];

      if (elementProps && callbackNameList) {
        // click -> onClick onClickCapture
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName];
          if (eventCallback) {
            if (i === 0) {
              paths.capture.unshift(eventCallback);
            } else {
              paths.bubble.push(eventCallback);
            }
          }
        });
      }
      targetElement = targetElement.parentNode;
    }

    return paths;
  }

  function createSyntheticEvent(e) {
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
  }

  function triggerEventFlow(paths, se) {
    for (let i = 0; i < paths.length; i++) {
      const callback = paths[i];
      callback.call(null, se);
      if (se.__stopPropagation) {
        break;
      }
    }
  }

  function dispatchEvent(container, eventType, e) {
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
  }

  function initEvent(container, eventType) {
    container.addEventListener(eventType, (e) => {
      dispatchEvent(container, eventType, e);
    });
  }

  const testHostAttr = (name) => /^on[A-Z]/.test(name);
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

  const domHostConfig = {
    toAttrName(key) {
      return (
        {
          className: "class",
        }[key] || key
      );
    },
    createInstance(type) {
      const element = document.createElement(type);
      return element;
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
      node.data = content;
    },
    commitInstanceUpdate(node, attrs) {
      for (let i = 0; i < attrs.length; i += 2) {
        const pKey = attrs[i];
        const pValue = attrs[i + 1];

        if (hostSpecialAttrSet.has(pKey)) {
          domHostConfig.fixHostSpecial(node, pKey, pValue);
        } else {
          const attrName = hostConfig.toAttrName(pKey);
          if (pValue === void 0) {
            node.removeAttribute(attrName);
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
  const useFiber = () => {
    return workInProgress;
  };

  const ComponentGenMemo = new WeakMap();
  const genComponentInnerElement = (fiber) => {
    if (
      !fiber.isSelfStateChange &&
      ComponentGenMemo.has(fiber) &&
      objectEqual(fiber.memoizedProps, fiber.pendingProps, true)
    ) {
      // keepalive
      return ComponentGenMemo.get(fiber);
    }

    let result = null;
    const preFiber = workInProgress;

    try {
      fiber._StateIndex = 0;
      workInProgress = fiber;
      result = fiber.type(fiber.pendingProps);
      ComponentGenMemo.set(fiber, result);
    } finally {
      workInProgress = preFiber;
    }

    return result;
  };

  const useReducer = (reducer, initialState) => {
    const fiber = useFiber();
    const innerIndex = fiber._StateIndex++;
    const { hookQueue, rerender } = fiber;

    if (hookQueue.length <= innerIndex) {
      const state =
        typeof initialState === "function" ? initialState() : initialState;

      const dispatch = (action) => {
        const newState = reducer(hookQueue[innerIndex].state, action);
        hookQueue[innerIndex].state = newState;
        rerender();
      };

      hookQueue[innerIndex] = { state, dispatch };
    }

    return [hookQueue[innerIndex].state, hookQueue[innerIndex].dispatch];
  };

  const useRef = (initialValue) => {
    const fiber = useFiber();
    const innerIndex = fiber._StateIndex++;
    const { hookQueue } = fiber;

    if (hookQueue.length <= innerIndex) {
      hookQueue[innerIndex] = { current: initialValue };
    }

    return hookQueue[innerIndex];
  };

  const useState = (initialState) => {
    return useReducer((state, action) => {
      return typeof action === "function" ? action(state) : action;
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
          f.flags |= Update;
        });
        fiber.memoizedState.clear();

        return children;
      },
    };
  };

  const useContext = (context) => {
    const fiber = useFiber();
    const providerFiber = findParentFiber(
      fiber,
      (f) => f.type === context.Provider
    );
    providerFiber.memoizedState.add(fiber);

    return providerFiber.pendingProps.value;
  };

  const useEffect = (func, dep) => {
    const fiber = useFiber();
    const innerIndex = fiber._StateIndex++;
    const { hookQueue } = fiber;

    if (hookQueue.length <= innerIndex) {
      if (Array.isArray(dep)) {
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
      if (
        Array.isArray(dep) &&
        Array.isArray(oldDep) &&
        dep.length &&
        oldDep.length
      ) {
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

      return subscribe(function handleStoreChange() {
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

      if (typeof destroy === "function") {
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

    if (fiber[hookName].size) {
      if (async) {
        otherQueueMacrotask(() => runner(fiber, hookName));
      } else {
        runner(fiber, hookName);
      }
    }
  };

  class Fiber {
    key = null;
    ref = null;
    type = null;
    pNodeKey = "";
    pendingProps = {};
    memoizedProps = {};
    memoizedState = null;

    _index = 0;
    oldIndex = -1;
    stateNode = null;

    root = null;
    child = null;
    return = null;
    sibling = null;
    deletions = [];

    flags = NoFlags;
    subtreeFlags = NoFlags;

    _StateIndex = 0;
    hookQueue = [];

    onSetup = new Set();
    onMounted = new Set();
    onUnMounted = new Set();
    onUpdated = new Set();
    onBeforeUpdate = new Set();
    onBeforeMove = new Set();
    onMoved = new Set();

    rerender = () => {
      if (Fiber.isHostFiber(this)) {
        console.warn(this.nodeKey);
        forceRender(this);
      } else {
        this.flags |= Update;
        Fiber.RerenderSet.add(this);
        queueMicrotaskOnce(batchRerender);
      }
    };

    get index() {
      return this._index;
    }
    set index(value) {
      this.oldIndex = this.oldIndex === -1 ? value : this._index;
      this._index = value;
    }

    get normalChildren() {
      let children = [];
      if (Fiber.isTextFiber(this)) {
        return children;
      }

      if (isHTMLTag(this.type)) {
        if (this.pendingProps.children !== void 0) {
          children = [].concat(this.pendingProps.children);
        }
      } else {
        const innerRootElement = genComponentInnerElement(this);
        if (innerRootElement !== void 0) {
          children = [].concat(innerRootElement);
        }
      }

      children = children.map((item) => {
        if (typeof item === "string" || typeof item === "number") {
          return jsx("text", { content: item });
        } else if (Array.isArray(item)) {
          return jsx(Fragment, { children: item });
        } else if (!item || !item.type) {
          return jsx("text", { content: "" });
        } else {
          return item;
        }
      });

      return children;
    }

    get isSelfStateChange() {
      return (this.flags & Update) !== NoFlags;
    }

    get isInStateChangeScope() {
      if (this.isSelfStateChange) {
        return true;
      } else if (!this.return) {
        return false;
      } else {
        return this.return.isInStateChangeScope;
      }
    }

    get isInPortalScope() {
      if (this.pendingProps.__target) {
        return true;
      } else if (!this.return) {
        return false;
      } else {
        return this.return.isInPortalScope;
      }
    }

    constructor(element, key, pNodeKey) {
      this.key = key;
      this.pNodeKey = pNodeKey;
      this.nodeKey = Fiber.genNodeKey(key, pNodeKey);
      this.type = element.type;
      this.pendingProps = element.props;
      this.flags = Placement;

      if (Fiber.isTextFiber(this)) {
        this.stateNode = hostConfig.createTextInstance(
          this.pendingProps.content
        );
      } else if (Fiber.isHostFiber(this)) {
        this.stateNode = hostConfig.createInstance(this.type);
      }

      if (this.stateNode) {
        this.stateNode.__fiber = this;
      }

      if (!Fiber.isHostFiber(this)) {
        dispatchHook(this, "onSetup");
      }
    }

    isDescendantOf(returnFiber) {
      return this.nodeKey.startsWith(returnFiber.nodeKey);
    }
  }

  Fiber.ExistPool = new Map();
  Fiber.RerenderSet = new Set();
  Fiber.genNodeKey = (key, pNodeKey = "") => pNodeKey + "^" + key;
  Fiber.isTextFiber = (fiber) => fiber && fiber.type === "text";
  Fiber.isHostFiber = (fiber) => fiber && typeof fiber.type === "string";

  const batchRerender = () => {
    const mapCount = new Map();
    let commonReturnHost = null;

    label: for (const current of Fiber.RerenderSet) {
      let fiber = current;
      while (fiber) {
        if (Fiber.isHostFiber(fiber)) {
          const preCount = mapCount.get(fiber) || 0;
          const curCount = preCount + 1;

          if (curCount >= Fiber.RerenderSet.size) {
            commonReturnHost = fiber;
            break label;
          } else {
            mapCount.set(fiber, curCount);
          }
        }
        fiber = fiber.return;
      }
    }

    Fiber.RerenderSet.clear();
    commonReturnHost.rerender();
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

  function bubbleFlags(fiber) {
    let subtreeFlags = NoFlags;
    for (const child of walkChildFiber(fiber)) {
      subtreeFlags |= child.subtreeFlags;
      subtreeFlags |= child.flags;
    }
    fiber.subtreeFlags |= subtreeFlags;
  }

  function createFiber(element, key, pNodeKey = "") {
    const nodeKey = Fiber.genNodeKey(key, pNodeKey);

    if (Fiber.ExistPool.has(nodeKey)) {
      const fiber = Fiber.ExistPool.get(nodeKey);
      fiber.pendingProps = element.props;
      fiber.flags &= Update;
      fiber.flags |= MarkReusableFiber;
      fiber.subtreeFlags = NoFlags;

      fiber.deletions = [];

      fiber.sibling = null;
      fiber.return = null;

      return fiber;
    }

    const fiber = new Fiber(element, key, pNodeKey);
    Fiber.ExistPool.set(nodeKey, fiber);
    return fiber;
  }

  let CollectingFiberQueue = [];
  let ConquerFiberQueue = [];
  const collectConquerFiber = (fiber) => {
    CollectingFiberQueue.push(fiber);
  };

  const findPreConquerFiber = (index, checker = checkTrue) => {
    for (let i = index - 1; -1 < i; i--) {
      const fiber = ConquerFiberQueue[i];
      if (checker(fiber)) {
        return fiber;
      }
    }
  };

  const findParentFiber = (fiber, checker = checkTrue) => {
    while (fiber.return) {
      if (checker(fiber.return)) {
        return fiber.return;
      }
      fiber = fiber.return;
    }
  };

  function beginWork(returnFiber) {
    const children = returnFiber.normalChildren;
    const result = [];

    const oldFiberMap = new Map();
    // child 还保留着旧子fiber的引用，用来收集 deletions
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
        fiber.oldIndex <= preOldIndex ||
        fiber.memoizedProps.__target !== fiber.pendingProps.__target
      ) {
        fiber.flags |= Placement;
      } else {
        preOldIndex = fiber.oldIndex;
      }

      if (index === 0) {
        returnFiber.child = fiber;
      } else {
        preFiber.sibling = fiber;
      }

      if (!Fiber.isHostFiber(returnFiber)) {
        fiber.flags |= returnFiber.flags & Placement;
      }

      preFiber = fiber;
      result.push(fiber);
    }

    returnFiber.deletions = [...oldFiberMap.values()];
    if (returnFiber.deletions.length) {
      returnFiber.flags |= ChildDeletion;
    }

    return result;
  }

  function finishedWork(fiber) {
    collectConquerFiber(fiber);
    if (!fiber.isInStateChangeScope) {
      return;
    }

    const oldProps = { ...(fiber.memoizedProps || {}) };
    const newProps = fiber.pendingProps || {};

    if (oldProps.ref !== newProps.ref) {
      const oldRef = oldProps.ref;
      const newRef = newProps.ref;

      fiber.ref = (instance) => {
        if (typeof oldRef === "function") {
          oldRef(null);
        } else if (oldRef && "current" in oldRef) {
          oldRef.current = null;
        }

        if (typeof newRef === "function") {
          newRef(instance);
        } else if (newRef && "current" in newRef) {
          newRef.current = instance;
        }
      };

      fiber.flags |= MarkRef;
    }

    if (Fiber.isTextFiber(fiber)) {
      if (!oldProps || newProps.content !== oldProps.content) {
        fiber.memoizedState = newProps.content;
        fiber.flags |= Update;
      }
    } else if (isHTMLTag(fiber.type)) {
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

        if (testHostAttr(pKey)) {
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

        if (testHostAttr(pKey)) {
          if (hostSpecialAttrSet.has(pKey)) {
            attrs.push(pKey, void 0);
          }
        } else {
          attrs.push(pKey, void 0);
        }
      }

      fiber.memoizedState = attrs;
      if (fiber.memoizedState.length) {
        fiber.flags |= Update;
      }
    } else {
      if (
        (fiber.flags & MarkReusableFiber) !== NoFlags &&
        !objectEqual(fiber.memoizedProps, fiber.pendingProps)
      ) {
        fiber.flags |= Update;
      }
    }

    bubbleFlags(fiber);
    fiber.memoizedProps = fiber.pendingProps;
  }

  function* walkFiber(returnFiber) {
    const fiberList = beginWork(returnFiber);

    for (const fiber of fiberList) {
      if (Fiber.isTextFiber(fiber)) {
        finishedWork(fiber);
        yield fiber;
      } else {
        yield* walkFiber(fiber);
      }
    }

    finishedWork(returnFiber);
    yield returnFiber;
  }

  const placementFiber = (fiber, index) => {
    const parentHostFiber = findParentFiber(
      fiber,
      (f) => Fiber.isHostFiber(f) || f.pendingProps.__target
    );

    if (!parentHostFiber) {
      return;
    }

    // 它是一个 portal: 用带有 __target 指向的 stateNode
    if (parentHostFiber.pendingProps.__target) {
      hostConfig.toLast(fiber.stateNode, parentHostFiber.pendingProps.__target);
      return;
    }

    const preHostFiber = findPreConquerFiber(
      index,
      (f) =>
        Fiber.isHostFiber(f) && !f.isDescendantOf(fiber) && !f.isInPortalScope
    );

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
    if (Fiber.isTextFiber(fiber)) {
      hostConfig.commitTextUpdate(fiber.stateNode, fiber.memoizedState);
    } else {
      hostConfig.commitInstanceUpdate(fiber.stateNode, fiber.memoizedState);
    }
  };

  const childDeletionFiber = (returnFiber) => {
    for (const fiber of returnFiber.deletions) {
      for (const f of walkFiberTree(fiber)) {
        if (Fiber.isHostFiber(f)) {
          hostConfig.removeChild(f.stateNode);
        } else {
          dispatchHook(f, "onUnMounted", true);
        }

        f.ref && f.ref(null);
        Fiber.ExistPool.delete(f.nodeKey);
      }
    }
    returnFiber.deletions = [];
  };

  const commitRoot = () => {
    let i = 0;
    const len = ConquerFiberQueue.length;

    while (i < len) {
      const fiber = ConquerFiberQueue[i];

      if (Fiber.isHostFiber(fiber)) {
        hostConfig.updateInstanceProps(fiber.stateNode, fiber.memoizedProps);
      }

      if ((fiber.flags & ChildDeletion) !== NoFlags) {
        childDeletionFiber(fiber);
        fiber.flags &= ~ChildDeletion;
      }

      if ((fiber.flags & Update) !== NoFlags) {
        if (Fiber.isHostFiber(fiber)) {
          updateHostFiber(fiber);
        } else {
          dispatchHook(fiber, "onBeforeUpdate");
          dispatchHook(fiber, "onUpdated", true);
        }
        fiber.flags &= ~Update;
      }

      if ((fiber.flags & Placement) !== NoFlags) {
        if (Fiber.isHostFiber(fiber)) {
          placementFiber(fiber, i);
        } else {
          if ((fiber.flags & MarkReusableFiber) !== NoFlags) {
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
        if (Fiber.isHostFiber(fiber)) {
          fiber.ref(fiber.stateNode);
        } else {
          fiber.ref(fiber);
        }

        fiber.flags &= ~MarkRef;
      }

      fiber.flags = NoFlags;
      i += 1;
    }

    ConquerFiberQueue.length = 0;
  };

  function forceRender(rootFiber) {
    let restoreDataFn;

    queueMacrotask((deadline) => {
      restoreDataFn = hostConfig.genRestoreDataFn();
      return innerRender(deadline, rootFiber);
    });

    queueMacrotask((deadline) => {
      const result = commitRoot(deadline);
      if (result === void 0 && restoreDataFn) {
        restoreDataFn();
      }
      return result;
    });
  }

  const innerRender = (deadline, rootFiber) => {
    if (!rootFiber.generator) {
      rootFiber.generator = walkFiber(rootFiber);
    }

    let taskObj;
    do {
      taskObj = rootFiber.generator.next();
      if (taskObj.done) {
        rootFiber.generator = null;
      } else if (deadline.didTimeout) {
        return (deadline) => innerRender(deadline, rootFiber);
      }
    } while (!taskObj.done);

    ConquerFiberQueue = CollectingFiberQueue;
    CollectingFiberQueue = [];
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
        rootFiber.flags |= Update;
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
