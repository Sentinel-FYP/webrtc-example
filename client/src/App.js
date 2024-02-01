import "./App.css";
import { useState } from "react";

const BASE_URL = "http://localhost:5000";
var pc = null;
function App() {
  const [started, setStarted] = useState(false);

  const negotiate = () => {
    if (!pc) throw new Error("pc is not defined");
    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });

    return pc
      .createOffer()
      .then((offer) => {
        console.log("offer created", offer);
        return pc.setLocalDescription(offer);
      })
      .then(() => {
        // wait for ICE gathering to complete
        return new Promise((resolve) => {
          if (pc.iceGatheringState === "complete") {
            console.log("iceGatheringState complete");
            resolve();
          } else {
            console.log("iceGatheringState not complete yet. waiting...");
            const checkState = () => {
              if (pc.iceGatheringState === "complete") {
                console.log("iceGatheringState complete after waiting.");
                pc.removeEventListener("icegatheringstatechange", checkState);
                resolve();
              }
            };
            pc.addEventListener("icegatheringstatechange", checkState);
          }
        });
      })
      .then(() => {
        var offer = pc.localDescription;
        return fetch(`${BASE_URL}/offer`, {
          body: JSON.stringify({
            sdp: offer.sdp,
            type: offer.type,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
      })
      .then((response) => {
        return response.json();
      })
      .then((answer) => {
        console.log("received aswer", answer);
        return pc.setRemoteDescription(answer);
      })
      .catch((e) => {
        alert(e);
      });
  };

  const start = () => {
    var config = {
      sdpSemantics: "unified-plan",
    };
    config.iceServers = [{ urls: ["stun:stun.l.google.com:19302"] }];

    pc = new RTCPeerConnection(config);

    // connect audio / video
    pc.addEventListener("track", (evt) => {
      console.log("track received", evt);
      if (evt.track.kind === "video") {
        document.getElementById("video").srcObject = evt.streams[0];
      }
    });

    setStarted(true);
    negotiate();
  };

  const stop = () => {
    document.getElementById("stop").style.display = "none";

    // close peer connection
    setTimeout(() => {
      pc.close();
    }, 500);
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
