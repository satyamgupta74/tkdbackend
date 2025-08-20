// server.js (ESM version)
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve frontend if needed

// ✅ Create HTTP server before Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
});

// --- Data Store ---
let courts = {};

// --- Helpers ---
function calculateBestOfTwo(courtId) {
  const court = courts[courtId];
  if (!court) return;

  let chongVotes = 0;
  let hongVotes = 0;

  // Take latest click per referee
  const latest = {};
  for (let ref of Object.keys(court.scores)) {
    if (court.scores[ref].length > 0) {
      latest[ref] = court.scores[ref][court.scores[ref].length - 1];
    }
  }

  for (let ref in latest) {
    if (!latest[ref]) continue;
    if (latest[ref].player === "chong") chongVotes++;
    if (latest[ref].player === "hong") hongVotes++;
  }

  let winner = null;
  if (chongVotes >= 2) {
    court.totalScore.chong++;
    winner = "chong";
  } else if (hongVotes >= 2) {
    court.totalScore.hong++;
    winner = "hong";
  }

  io.to(courtId).emit("updateScoreboard", {
    courtId,
    totalScore: court.totalScore,
    round: court.round,
    roundWins: court.roundWins,
    lastDecision: winner,
  });
}

// --- Socket Events ---
io.on("connection", (socket) => {
  console.log("🔗 Client connected:", socket.id);

  socket.on("createCourt", ({ courtId, otp, referees }) => {
    courts[courtId] = {
      otp,
      referees,
      scores: {},
      round: 1,
      roundWins: { chong: 0, hong: 0 },
      totalScore: { chong: 0, hong: 0 },
    };
    referees.forEach((r) => (courts[courtId].scores[r] = []));
    console.log(`📋 Court created: ${courtId}`, courts[courtId]);
  });

  socket.on("refereeJoined", ({ referee, court, otp }) => {
    const courtData = courts[court];
    if (!courtData || courtData.otp !== otp) {
      socket.emit("joinError", "❌ Invalid court or OTP");
      return;
    }
    socket.join(court);
    console.log(`👨‍⚖️ Referee ${referee} joined ${court}`);
    socket.emit("joinSuccess", { referee, court });
  });

  socket.on("refereeScore", ({ referee, court, player, points }) => {
    if (!courts[court]) return;
    if (!courts[court].scores[referee]) return;

    // Save the score
    courts[court].scores[referee].push({ player, points });

    // ✅ Print log in backend console
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `🖱️ [${timestamp}] Referee:${referee} | Court:${court} | Player:${player.toUpperCase()} | Points:${points}`
    );

    // Process scoring
    calculateBestOfTwo(court);
  });

  socket.on("joinScoreboard", ({ court }) => {
    if (!courts[court]) return;
    socket.join(court);
    console.log(`📺 Scoreboard joined for court ${court}`);
    socket.emit("updateScoreboard", {
      courtId: court,
      totalScore: courts[court].totalScore,
      round: courts[court].round,
      roundWins: courts[court].roundWins,
      lastDecision: null,
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// --- REST APIs ---

// ✅ Test API (for Postman or Browser)
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running ✅", time: new Date().toISOString() });
});

// ✅ Get all courts info
app.get("/api/courts", (req, res) => {
  res.json(courts);
});

// ✅ Manual referee score API (optional if you want REST also)
app.post("/api/refereeScore", (req, res) => {
  const { referee, court, player, points } = req.body;
  if (!courts[court]) return res.status(400).send("Invalid court");

  courts[court].scores[referee].push({ player, points });

  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `🖱️ [${timestamp}] Referee:${referee} | Court:${court} | Player:${player.toUpperCase()} | Points:${points}`
  );

  calculateBestOfTwo(court);

  res.json({ success: true });
});

// --- Start server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log("✅ Server running on http://localhost:" + PORT);
});
