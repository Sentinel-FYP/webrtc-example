const app = require("express")();
const httpServer = require("http").createServer(app);
const os = require("os");

// Get the network interfaces
const networkInterfaces = os.networkInterfaces();

const io = require("socket.io")(httpServer, { cors: true });
const port = process.env.PORT;
if (!port) {
  throw new Error("Port is not defined");
}
let rooms = {};

io.on("connection", (socket) => {
  console.log("Connected =>", socket.id);

  let currentDeviceId;

  socket.on("answer", (data) => {
    // console.log("Server Received answer:", data);
    console.log("Server Received answer", data);
    // console.log(rooms[data.deviceId].userSocketId);
    io.emit("answer", data);
  });

  socket.on("disconnect", () => {
    console.log("Disconnect", currentDeviceId);
  });

  socket.on("offer", (data) => {
    console.log("Recieved an offer from the edge device", data);
    io.emit("offer", data);
    // console.log(JSON.stringify(data.offer, null, 2));
  });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

httpServer.listen(port, () => {
  // Loop through the network interfaces to find the IP address
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaceData = networkInterfaces[interfaceName];
    for (const network of interfaceData) {
      if (network.family === "IPv4" && !network.internal) {
        console.log(`Server IP address: http://${network.address}:${port}`);
      }
    }
  });
});
