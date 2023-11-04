import {
  createRoot,
  useState,
  useEffect,
  useContext,
  createContext,
} from "../module";

function MovingDot() {
  const [position, setPosition] = useState({
    x: 0,
    y: 0,
  });

  return (
    <div
      onMousemove={(e) => {
        setPosition({
          x: e.clientX,
          y: e.clientY,
        });
      }}
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
      }}
    >
      <div
        style={{
          position: "absolute",
          backgroundColor: "red",
          borderRadius: "50%",
          transform: `translate(${position.x}px, ${position.y}px)`,
          left: -10 + "px",
          top: -10 + "px",
          width: 20 + "px",
          height: 20 + "px",
        }}
      />
    </div>
  );
}

createRoot(document.querySelector("#app")).render(<MovingDot />);
