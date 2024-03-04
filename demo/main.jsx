import {
  createRoot,
  Fragment,
  useState,
  useEffect,
  useFiber,
  useContext,
  createContext,
} from "../module";

function Hello(props) {
  const [state, setState] = useState("aimwhy");
  const [state2, setState2] = useState("tt");

  useEffect(() => {
    console.log("%c Hello Mounted", "color:#0f0;");
  }, []);

  useEffect(() => {
    console.log("%c Hello Update", "color:red;");
  });

  useEffect(
    (cur, pre) => {
      console.log("%c Hello Dep Update", "color:#990;");
    },
    [window.a]
  );

  return (
    <>
      {props.children()}
      <div>{state}</div>
      <div>{state2}</div>
      <input
        ref={(dom) => {
          window.abc = dom;
        }}
        type="text"
        value={state}
        onInput={(e) => {
          console.log("onInput");
          // props.parentChange((v) => !v);
          setState(e.target.value);
          setState2(() => "tt" + e.target.value.slice(-3));
        }}
      />
    </>
  );
}

function World(props) {
  const [state, setState] = useState("点击我");

  useEffect(() => {
    console.log("%c World Mounted", "color:#0f0;");
    return () => {
      console.log("%c World UnMounted", "color:#0f0;");
    };
  }, []);

  return <div>{state}</div>;
}

const memo = () => <i>i {5555}</i>;

function App(props) {
  const [state, setState] = useState(true);
  const [state2, setState2] = useState(true);

  useEffect(() => {
    console.log("%c App Update", "color:#990;");
  });

  return (
    <Fragment key="99">
      <button
        onClick={() => {
          setState((v) => !v);
        }}
      >
        点击事件
      </button>

      <Fragment key="小羽毛key" $target={state ? document.body : void 0}>
        <div>
          <div>小羽毛是个</div>
          <div>机灵鬼</div>
        </div>
      </Fragment>

      <Fragment key="88">
        <div>Fragment</div>
      </Fragment>

      <Fragment key="799" $target={document.body}>
        <div>Portal-body A</div>
      </Fragment>

      {!state ? (
        <Fragment key="77" $target={document.body}>
          <div>
            <div>Portal-999999999999999</div>
            <div>Portal-666666666666666</div>
          </div>
        </Fragment>
      ) : (
        "Portal inner"
      )}

      <div>
        <Hello parentChange={setState2} key="hello">
          {memo}
        </Hello>
      </div>

      {state ? (
        <World
          ref={(dom) => {
            window.b = dom;
          }}
        />
      ) : (
        <div>销毁后的文案</div>
      )}

      {["github!", null, " aimwhy"]}
    </Fragment>
  );
}

createRoot(document.querySelector("#app")).render(<App />);
