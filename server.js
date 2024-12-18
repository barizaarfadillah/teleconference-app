const express = require("express");
const app = express();
const fs = require("fs");
const https = require("https");
const http = require("http");
const io = require("socket.io");
const bodyParser = require("body-parser");
const { ExpressPeerServer } = require("peer");
const session = require("express-session");

// Memuat sertifikat SSL
const options = {
  key: fs.readFileSync("./certs/server.key"),
  cert: fs.readFileSync("./certs/server.crt"),
};

// Middleware untuk PeerJS
const httpsServer = https.createServer(options, app);
const peerServer = ExpressPeerServer(httpsServer, {
  debug: true,
});

// Socket.IO dengan server HTTPS
const socketIo = io(httpsServer);

// Middleware
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use("/peerjs", peerServer);
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware session
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true },
  })
);

let activeScreenSharer = null;

// Rute untuk halaman utama
app.get("/", (req, res) => {
  res.render("index");
});

// Rute untuk membuat room
app.post("/create-room", (req, res) => {
  const roomName = req.body.roomName;
  const username = req.body.username;
  const roomId = generateRoomId();

  req.session.roomInfo = {
    roomId,
    roomName,
    username,
  };

  res.send(`
    <script>
      window.location.href = "/${roomId}?roomName=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}";
    </script>
  `);
});

// Rute untuk join room
app.post("/join-room", (req, res) => {
  const roomId = req.body.roomId;
  const username = req.body.username;
  const roomName = req.body.roomName;

  req.session.roomInfo = {
    roomId,
    roomName,
    username,
  };

  res.send(`
    <script>
      window.location.href = "/${roomId}?username=${encodeURIComponent(username)}";
    </script>
  `);
});

// Rute untuk room
app.get("/:room", (req, res) => {
  const roomId = req.params.room;
  const roomInfo = req.session.roomInfo || {};

  res.render("room", {
    roomId: roomInfo.roomId || roomId,
    roomName: roomInfo.roomName || "Unnamed Room",
    username: roomInfo.username || "Guest",
  });
});

// Rute untuk meninggalkan room
app.post("/leave-room", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Error destroying session:", err);
      return res.status(500).send("Error leaving room");
    }
    res.redirect("/");
  });
});

// Socket.IO untuk komunikasi real-time
socketIo.on("connection", (socket) => {
  let username;
  socket.on("join-room", (roomId, userId, userUsername) => {
    username = userUsername;
    socket.join(roomId);
    socket.to(roomId).broadcast.emit("user-connected", userId, username);

    console.log(`${username} joined room: ${roomId}`);

    socket.on("message", (message, username) => {
      socketIo.to(roomId).emit("createMessage", username, message);
    });

    // Event saat pengguna meninggalkan room
    socket.on("disconnect", () => {
      if (username) {
        socket.to(roomId).broadcast.emit("user-disconnected", userId, username);
        console.log(`${username} left room: ${roomId}`);
      }
    });
    
    socket.on("start-screen-sharing", (username) => {
      if (activeScreenSharer) {
        socket.emit("error", "Screen sharing is already active.");
        return;
      }
      activeScreenSharer = username;
      socketIo.to(roomId).emit("screen-sharing-started", username);
    });

    socket.on("stop-screen-sharing", () => {
      if (activeScreenSharer === username) {
        activeScreenSharer = null;
        socketIo.to(roomId).emit("screen-sharing-stopped", username);
      }
    });
  });
});

// Fungsi untuk membuat Room ID unik
function generateRoomId() {
  let roomId;

  roomId = Math.floor(Math.random() * 900000000) + 100000000;

  return roomId;
}

// Redirect HTTP ke HTTPS
http.createServer((req, res) => {
  res.writeHead(301, { Location: "https://" + req.headers.host + req.url });
  res.end();
}).listen(3000, () => {
  console.log("Redirecting HTTP to HTTPS on port 3000");
});

// Menjalankan server HTTPS
const PORT = process.env.PORT || 3001;
httpsServer.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTPS Server running at https://0.0.0.0:${PORT}`);
});
