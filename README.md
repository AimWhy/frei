# frei

# 已实现的api
```js
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
```


# 代码实例：
```jsx
import {
  createRoot,
  useState,
  useEffect,
  useContext,
  createContext,
  Fragment,
} from "../module";

const NameContext = createContext("theme");

function Hello(props) {
  const [age, setAge] = useState(18);
  console.log("Hello change");
  useEffect(() => {
    console.log("%c Hello Update", "color:#990;");
  });

  return (
    <div>
      <button onClick={() => setAge((a) => a + 1)}>涨年龄</button>
      <div>{age}</div>
      <div>{props.school}</div>
      <hr />
      <World></World>
    </div>
  );
}

function World(props) {
  console.log("World change");

  useEffect(() => {
    console.log("%c World Update", "color:#990;");
  });

  const name = useContext(NameContext);
  return <div>{name}</div>;
}

function Test() {
  const [name, setName] = useState("test");
  window.setName = setName;
  return name;
}

function App() {
  const [name, setName] = useState("nll");

  console.log("App change");

  useEffect(() => {
    console.log("%c App Update", "color:#990;");
  });

  return (
    <div>
      <NameContext.Provider value={name}>
        <button onClick={() => setName((a) => a + 1)}>换名字</button>
        <div>{name}</div>
        <div>
          <Hello school="school"></Hello>
        </div>
      </NameContext.Provider>

      <Fragment key="799" __target={document.body}>
        <Test />
      </Fragment>
    </div>
  );
}

createRoot(document.querySelector("#app")).render(<App />);

```
