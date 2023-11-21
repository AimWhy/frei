# frei
 ![Screenshot 2023-11-12 at 7 22 44 PM](https://user-images.githubusercontent.com/3374055/282318144-d26961cc-de14-44e7-9741-3b2954447f6b.png)
 ![Screenshot 2023-11-18 at 2 35 42 PM](https://user-images.githubusercontent.com/3374055/284001902-b8eea901-dd60-4801-84bf-674164332377.png)
 ![Screenshot 2023-11-19 at 9 21 40 PM](https://user-images.githubusercontent.com/3374055/284088116-2eddc2c7-11ff-43c7-a0ee-60cbb4447ac6.png)
 

Thanks   @krausest 
https://github.com/krausest/js-framework-benchmark
https://krausest.github.io/js-framework-benchmark/


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
