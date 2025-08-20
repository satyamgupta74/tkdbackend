// server.js (REST API version for Vercel)
import express from "express";
import cors from "cors";

// --- App setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Data Store ---
let courts = {};

// --- Helpers ---
function calculateBestOfTwo(courtId) {
  const court = courts[courtId];
  if (!court) return null;

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

  return {
    courtId,
    totalScore: court.totalScore,
    round: court.round,
    roundWins: court.roundWins,
    lastDecision: winner,
  };
}

// --- Routes ---

// ✅ Test API
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running ✅", time: new Date().toISOString() });
});

// ✅ Create a court
app.post("/api/createCourt", (req, res) => {
  const { courtId, otp, referees } = req.body;

  if (courts[courtId]) {
    return res.status(400).json({ error: "Court already exists" });
  }

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
  res.json({ success: true, court: courts[courtId] });
});

// ✅ Get all courts (for debugging)
app.get("/api/courts", (req, res) => {
  res.json(courts);
});

// ✅ Submit referee score
app.post("/api/refereeScore", (req, res) => {
  const { referee, court, player, points } = req.body;

  if (!courts[court]) return res.status(400).send("Invalid court");
  if (!courts[court].scores[referee])
    return res.status(400).send("Invalid referee");

  courts[court].scores[referee].push({ player, points });

  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `🖱️ [${timestamp}] Referee:${referee} | Court:${court} | Player:${player.toUpperCase()} | Points:${points}`
  );

  const result = calculateBestOfTwo(court);

  res.json({ success: true, result });
});

// ✅ Get scoreboard for a court
app.get("/api/scoreboard/:courtId", (req, res) => {
  const { courtId } = req.params;
  if (!courts[courtId]) return res.status(404).send("Court not found");
  res.json(calculateBestOfTwo(courtId));
});

// --- Export for Vercel ---
export default app;
