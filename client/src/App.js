import "./App.css";
import { useState } from "react";
import {
  closeConnection,
  initializeConnection,
  negotiateWithSocket,
} from "./socket";

function App() {
  const [started, setStarted] = useState(false);

  const start = () => {
    setStarted(true);
    // negotiate();
    initializeConnection();
    negotiateWithSocket();
  };

  const stop = () => {
    setStarted(false);
    closeConnection();
  };

  return (
    <div>
      <button
        id="start"
        onClick={start}
        style={{ display: started ? "none" : "block" }}
      >
        Start
      </button>
      <button
        id="stop"
        style={{ display: started ? "block" : "none" }}
        onClick={stop}
      >
        Stop
      </button>

      <div id="media">
        <h2>Media</h2>

        <audio id="audio" autoPlay></audio>
        <video id="video" autoPlay playsInline></video>
      </div>
    </div>
  );
}

export default App;
