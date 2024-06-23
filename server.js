const http = require("http");
const express = require("express");
const socketio = require("socket.io");

const app = express();
const expressServer = http.createServer(app);
const io = socketio(expressServer, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

expressServer.listen(8081, () => {
  console.log("listening on 8081");
});

// Namespace for managing waitlist and grouping
const waitroom = io.of("/waitroom");

const waitlist = [];

waitroom.on("connection", (socket) => {
  console.log("Someone has connected to waitroom");

  socket.on("join", () => {
    waitlist.push(socket);
    // console.log("User joined waitlist");
    if (waitlist.length == 3) {
      const group = waitlist.splice(0, 4);
      const roomId = `room-${Date.now()}`;

      group.forEach((user) => {
        // user.join(roomId);
        user.emit("grouped", roomId);
      });

      // io.to(roomId).emit("startChat", roomId);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected from waitroom");
    const index = waitlist.indexOf(socket);
    if (index !== -1) {
      waitlist.splice(index, 1);
    }
  });
});

function getAllRooms(namespace) {
  const rooms = namespace.adapter.rooms;
  return Array.from(rooms.keys());
}

const chatroom = io.of("/chatroom");

chatroom.on("connection", (socket) => {
  console.log("Someone has connected to chatroom");

  socket.on("chatMessage", (data) => {
    console.log("Received chat message", data);
    const { roomId, message, username } = data;
    // console.log("roomId", roomId);
    // console.log("message", message);
    console.log("username", username);
    chatroom.to(roomId).emit("chatMessage", { message, username });
  });

  socket.on("joinRoom", (roomId) => {
    console.log("User joined chatroom", roomId);
    socket.join(roomId);
  });

  // socket.on("getAllRooms", () => {
  //   console.log("Getting all rooms");
  //   const rooms = getAllRooms(chatroom);
  //   console.log("Rooms", rooms);
  //   // socket.emit("allRooms", rooms);
  // });

  socket.on("disconnect", () => {
    console.log("User disconnected from chatroom");
  });
});
