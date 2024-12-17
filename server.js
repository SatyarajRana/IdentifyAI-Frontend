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
    console.log("User joined waitlist");
    if (waitlist.length == 3) {
      console.log("Grouping users");

      const group = waitlist.splice(0, 4);
      const roomId = `room-${Date.now()}`;
      const randomQuestions = questions
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const ai_response = "This is AI's response!!";
      roomRounds[roomId] = {
        round: 1,
        questions: randomQuestions,
        timer: null,
        ai_response: ai_response,
        users: [],
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

    chatroom.to(roomId).emit("chatMessage", { message, username });
  });

  socket.on("joinRoom", (data) => {
    const { roomId, username } = data;

    socket.join(roomId);
    const room = chatroom.adapter.rooms.get(roomId);
    // let roomData = roomRounds[roomId];

    const socketId = socket.id;
    // roomData.users[username] = socketId;
    roomRounds[roomId].users.push({
      username,
      socketId,
      kicked: false,
      votes: 0,
    });

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

  socket.on("voted", (data) => {
    console.log("Received vote", data);
    const { roomId, username, votedFor } = data;
    const roomData = roomRounds[roomId];
    if (!roomData) return;

    const user = roomData.users.find((user) => user.socketId === votedFor);
    if (!user) return;

    user.votes += 1;
    console.log("User", user.username, "has", user.votes, "votes");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected from chatroom");
  });
});
function startRound(roomId) {
  const roomData = roomRounds[roomId];
  if (!roomData) return;
  const { round, questions, ai_response } = roomData;

  chatroom.to(roomId).emit("newRound", { round });

  roomData.timer = setTimeout(() => sendAIResponse(roomId, ai_response), 5000);
  roomData.timer = setTimeout(() => sendVotingRequest(roomId), 30000);
  // roomData.timer = setTimeout(() => endRound(roomId), 30000);
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

function sendAIResponse(roomId, ai_response) {
  chatroom.to(roomId).emit("chatMessage", {
    message: ai_response,
    username: "Jonathan",
  });
}
function sendVotingRequest(roomId) {
  const roomData = roomRounds[roomId];
  if (!roomData) return;
  const { round, questions, ai_response, users } = roomData;
  chatroom.to(roomId).emit("votingRequest", { users });
}
