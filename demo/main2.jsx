import {
  createRoot,
  useState,
  useEffect,
  useContext,
  createContext,
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

function App() {
  const [name, setName] = useState("nll");

  console.log("App change");

  useEffect(() => {
    console.log("%c App Update", "color:#990;");
  });

  return (
    <NameContext.Provider value={name}>
      <button onClick={() => setName((a) => a + 1)}>换名字</button>
      <div>{name}</div>
      <Hello school="school"></Hello>
    </NameContext.Provider>
  );
}

createRoot(document.querySelector("#app")).render(<App />);
