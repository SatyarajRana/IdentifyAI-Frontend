// const http = require("http");
// const express = require("express");
// const socketio = require("socket.io");
// const questions = require("./questions");
import http from "http";
import express from "express";
import { Server } from "socket.io";
import questions from "./questions.js";

const app = express();
const expressServer = http.createServer(app);
const io = new Server(expressServer, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});
// const io = socketio(expressServer, {
//   cors: {
//     origin: ["http://localhost:3000"],
//     methods: ["GET", "POST"],
//   },
// });

expressServer.listen(8081, () => {
  console.log("listening on 8081");
});

const waitroom = io.of("/waitroom");

const waitlist = [];
const roomRounds = {};

waitroom.on("connection", (socket) => {
  console.log("Someone has connected to waitroom");

  socket.on("join", () => {
    waitlist.push(socket);
    // console.log("User joined waitlist");
    if (waitlist.length == 3) {
      const group = waitlist.splice(0, 4);
      const roomId = `room-${Date.now()}`;
      const randomQuestions = questions
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      roomRounds[roomId] = {
        round: 1,
        questions: randomQuestions,
        timer: null,
      };
      group.forEach((user) => {
        user.emit("grouped", { roomId, questions: randomQuestions });
      });
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
    const room = chatroom.adapter.rooms.get(roomId);
    if (room.size == 3) {
      console.log("Room is full");
      console.log(roomId);
      startRound(roomId);
    }
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
function startRound(roomId) {
  console.log("Starting round");
  console.log("Room ID", roomId);
  const roomData = roomRounds[roomId];
  if (!roomData) return;
  console.log("Room data", roomData);
  const { round, questions } = roomData;

  // Notify clients about the new round
  chatroom.to(roomId).emit("newRound", { round });

  // Set a timer to end the round after 30 seconds
  roomData.timer = setTimeout(() => endRound(roomId), 10000);
}

function endRound(roomId) {
  const roomData = roomRounds[roomId];
  if (!roomData) return;

  clearTimeout(roomData.timer);
  roomData.round += 1;

  if (roomData.round > roomData.questions.length) {
    // All rounds are complete
    chatroom.to(roomId).emit("endGame");
    delete roomRounds[roomId]; // Clean up room data
  } else {
    // Start the next round
    startRound(roomId);
  }
}
