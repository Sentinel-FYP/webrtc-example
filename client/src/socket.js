import io from "socket.io-client";

const BASE_URL = "http://192.168.100.8:5000";
let pc = null;
var socket = io(BASE_URL);

const initializeConnection = () => {
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
};

const negotiateWithSocket = () => {
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
      socket.emit("offer", {
        sdp: offer.sdp,
        type: offer.type,
      });
    })
    .catch((e) => {
      alert(e);
    });
};

const closeConnection = () => {
  setTimeout(() => {
    pc.close();
  }, 500);
};

socket.on("connect", () => {
  console.log("Connected =>", socket.id);
});

socket.on("answer", (answer) => {
  console.log("received aswer", answer);
  return pc.setRemoteDescription(answer);
});

socket.on("disconnect", () => {
  console.log("Disconnected =>", socket.id);
});

export { initializeConnection, negotiateWithSocket, closeConnection };
