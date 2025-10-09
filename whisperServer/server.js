const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const fs = require("fs");
const os = require("os");
const sqlite3 = require("sqlite3").verbose();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const execPromise = promisify(exec);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI("AIzaSyBNuyurnXSwnqpCkCF9i1TjfX20Mn8s1PY");

// Initialize SQLite Database
const db = new sqlite3.Database("./transcriptions.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database.");
    // Create transcriptions table
    db.run(`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileType TEXT NOT NULL,
        duration REAL,
        transcription TEXT NOT NULL,
        summary TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error("Error creating table:", err.message);
      } else {
        console.log("Transcriptions table ready.");
        
        // Add summary column if it doesn't exist (migration)
        db.run(`ALTER TABLE transcriptions ADD COLUMN summary TEXT`, (alterErr) => {
          if (alterErr) {
            // Column already exists, which is fine
            if (!alterErr.message.includes("duplicate column name")) {
              console.error("Migration error:", alterErr.message);
            }
          } else {
            console.log("Summary column added to existing table.");
          }
        });
      }
    });
  }
});


const app = express();
const PORT = 5001; // This port is used when running the server on the host machine

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});


// ====================================================
// In-Memory User Management (for Demo)
// ====================================================
const users = {
  "user123456": { password: "secret1" },
  "user654321": { password: "secret2" },
};

// Set to track logged-in users
const loggedInUsers = new Set();

// ====================================================
// Authentication Endpoints: Login & Logout
// ====================================================

app.post("/login", (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res
      .status(400)
      .json({ message: "User ID and password are required." });
  }
  const user = users[userId];
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // Simply track the logged-in user
  loggedInUsers.add(userId);
  res.json({
    message: "Login successful.",
    userId,
  });
  console.log("User logged in: ", userId);
});

app.post("/logout", (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res
      .status(400)
      .json({ message: "User ID and password are required." });
  }
  const user = users[userId];
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // Remove user from logged-in set
  if (!loggedInUsers.has(userId)) {
    return res.status(400).json({ message: "User is not logged in." });
  }
  
  loggedInUsers.delete(userId);
  res.json({ message: "Logout successful." });
  console.log("User logged out: ", userId);
});

// ====================================================
// Server Code for Settings, Metrics, etc.
// ====================================================

// Metrics tracking
const metrics = {
  totalRequests: 0,
  queuedRequests: 0,
  activeRequests: 0,
  failedRequests: 0,
  successfulRequests: 0,
  startTime: Date.now(),
  errorLogs: [],
  requestLogs: [],
};

// Hardcoded configuration - cannot be changed at runtime
const globalSettings = {
  temperature: 0.0,
  beam_size: 5,
  condition_on_previous_text: "True",
  threads: 7,
  no_speech_threshold: 0.6,
  compression_ratio_threshold: 2.4,
  device: "cpu",
  fp16: "True",
};

// Error handling middleware
app.use((err, req, res, next) => {
  metrics.failedRequests++;
  metrics.errorLogs.push({
    error: err.message,
    timestamp: new Date(),
  });
  res.status(500).send("Internal server error.");
});

// Admin API to fetch metrics
const osUtils = require("os-utils");

app.get("/admin/metrics", (req, res) => {
  const uptime = process.uptime();
  const totalMemory = os.totalmem();
  const usedMemory = totalMemory - os.freemem();

  osUtils.cpuUsage((usage) => {
    const stats = {
      ...metrics,
      uptime: `${Math.floor(uptime / 60)} minutes`,
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
      },
      cpuUsage: usage,
    };
    res.json(stats);
  });
});

// ====================================================
// File Upload Configuration
// ====================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// ====================================================
// Queue Management for Processing Requests
// ====================================================
let activeRequests = 0;
const maxConcurrentRequests = 3;
const requestQueue = [];
const requestStatus = new Map();

const processQueue = () => {
  while (activeRequests < maxConcurrentRequests && requestQueue.length > 0) {
    const { req, res, id, userId } = requestQueue.shift();
    requestStatus.set(id, { status: "processing", position: null });
    activeRequests++;
    handleRequest(req, res, id, userId).finally(() => {
      activeRequests--;
      metrics.queuedRequests--;
      processQueue();
    });
  }
};

// ====================================================
// Request Processing: Transcription
// ====================================================
const handleRequest = async (req, res, id, userId) => {
  try {
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const outputFilePath = `uploads/${Date.now()}-converted.wav`;
    const selectedModel = req.body.model || "large";
    let fileDuration = 0;
    let fileType = '';

    await new Promise((resolve, reject) => {
      // First, get file duration and type using ffprobe
      exec(`ffprobe -v error -show_entries format=duration -of json "${filePath}"`, (err, stdout) => {
        if (err) {
          console.error("Error getting file duration:", err);
        } else {
          try {
            const durationInfo = JSON.parse(stdout);
            fileDuration = parseFloat(durationInfo.format?.duration || 0);
          } catch (e) {
            console.error("Error parsing duration:", e);
          }
        }

        // Determine file type
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const videoFormats = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'];
        fileType = videoFormats.includes(fileExtension) ? 'video' : 'audio';

        // Run ffprobe to check if file has audio stream (works for both audio and video)
        exec(`ffprobe -i "${filePath}" -show_streams -select_streams a -of json`, (err, stdout) => {
          if (err) {
            metrics.errorLogs.push({ error: err.message, timestamp: new Date() });
            console.error("Error checking file format:", err);
            return reject(new Error("Error checking file format."));
          }

          try {
            const info = JSON.parse(stdout);
            const audioStream = info.streams?.[0];
            if (!audioStream) {
              return reject(new Error("No audio stream found in the file."));
            }

            const sampleRate = audioStream.sample_rate;
            const codec = audioStream.codec_name;

            if (sampleRate === "16000" && codec === "pcm_s16le") {
              runCommand(filePath, selectedModel, id, res, resolve, reject, userId, fileName, fileType, fileDuration);
            } else {
              // Convert the file (audio or video) to audio format needed by Whisper
              // This command extracts audio from video files and converts to required format
              exec(`ffmpeg -i "${filePath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputFilePath}"`, (convertErr) => {
                if (convertErr) {
                  metrics.errorLogs.push({ error: convertErr.message, timestamp: new Date() });
                  console.error("Error converting file:", convertErr);
                  return reject(new Error("Error converting file."));
                }
                fs.unlinkSync(filePath);
                runCommand(outputFilePath, selectedModel, id, res, resolve, reject, userId, fileName, fileType, fileDuration);
              });
            }
          } catch (parseErr) {
            console.error("Error parsing ffprobe output:", parseErr);
            return reject(new Error("Error processing file metadata."));
          }
        });
      });
    });
  } catch (error) {
    console.error("Error in handleRequest:", error.message);
    metrics.failedRequests++;
    metrics.errorLogs.push({ error: error.message, timestamp: new Date() });
    requestStatus.set(id, { status: "failed", position: null });
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  } finally {
    processQueue();
  }
};

const runCommand = (filePath, model, id, res, resolve, reject, userId, fileName, fileType, fileDuration) => {
  const {
    temperature,
    beam_size,
    condition_on_previous_text,
    threads,
    no_speech_threshold,
    compression_ratio_threshold,
    device,
    fp16,
  } = globalSettings;

  const params = [
    `--temperature ${temperature}`,
    beam_size ? `--beam_size ${beam_size}` : "",
    condition_on_previous_text
      ? `--condition_on_previous_text ${condition_on_previous_text}`
      : `--condition_on_previous_text False`,
    threads ? `--threads ${threads}` : `--threads 0`,
    no_speech_threshold ? `--no_speech_threshold ${no_speech_threshold}` : `--no_speech_threshold 0.6`,
    compression_ratio_threshold
      ? `--compression_ratio_threshold ${compression_ratio_threshold}`
      : `--compression_ratio_threshold 2.4`,
    device ? `--device ${device}` : `--device cpu`,
    fp16 ? `--fp16 ${fp16}` : `--fp16 True`,
  ]
    .filter(Boolean)
    .join(" ");

  // Run the transcription command (whisper) on the host.
  const command = `whisper ${filePath} --model ${model} --task translate --output_format txt ${params}`;

  exec(command, async (err, stdout) => {
    if (err) {
      console.error("Error running command:", err);
      metrics.failedRequests++;
      metrics.errorLogs.push({ error: err.message, timestamp: new Date() });
      if (!res.headersSent) {
        res.status(500).json({ error: "Error running transcription command." });
      }
      return reject(new Error("Error running transcription command."));
    }

    const cleanedOutput = stdout.replace(/\x1b\[[0-9;]*m/g, "");

    // Generate summary using Gemini AI
    let summary = "";
    try {
      console.log("Generating summary with Gemini AI...");
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `Please provide a concise summary of the following transcription in 3-4 sentences:\n\n${cleanedOutput.trim()}`;
      const result = await geminiModel.generateContent(prompt);
      const response = await result.response;
      summary = response.text();
      console.log("Summary generated successfully");
    } catch (summaryErr) {
      console.error("Error generating summary:", summaryErr.message);
      summary = "Summary generation failed.";
    }

    // Save transcription and summary to database
    db.run(
      `INSERT INTO transcriptions (userId, fileName, fileType, duration, transcription, summary) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, fileName, fileType, fileDuration, cleanedOutput.trim(), summary],
      function(err) {
        if (err) {
          console.error("Error saving to database:", err.message);
        } else {
          console.log(`Transcription and summary saved to database with ID: ${this.lastID}`);
        }
      }
    );

    // Successfully completed transcription
    console.log("Transcription completed for user:", userId);
    metrics.successfulRequests++;
    metrics.activeRequests--;
    metrics.requestLogs.push({
      id,
      text: `Transcription completed for user: ${userId}`,
      timestamp: new Date(),
    });
    requestStatus.set(id, { status: "completed", position: null });
    
    // Return the transcription result with summary
    if (!res.headersSent) {
      res.json({ 
        transcription: cleanedOutput.trim(), 
        summary: summary,
        id 
      });
    }
    return resolve();
  });
};

// ====================================================
// File Upload Endpoint
// ====================================================
app.post("/upload", upload.single("audio"), (req, res) => {
  // Expect the userId to be included in the form-data.
  const userId = req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId in the request." });
  }
  if (!loggedInUsers.has(userId)) {
    return res
      .status(400)
      .json({ error: "User not logged in. Please login." });
  }

  const id = Date.now().toString();
  metrics.totalRequests++;
  metrics.activeRequests++;
  metrics.requestLogs.push({
    id,
    method: req.method,
    url: req.url,
    timestamp: new Date(),
  });

  if (activeRequests < maxConcurrentRequests) {
    activeRequests++;
    requestStatus.set(id, { status: "processing", position: null });
    handleRequest(req, res, id, userId).finally(() => {
      activeRequests--;
      processQueue();
    });
  } else {
    const position = requestQueue.length + 1;
    metrics.queuedRequests++;
    requestQueue.push({ req, res, id, userId });
    requestStatus.set(id, { status: "queued", position });
  }

  // Update queue positions if needed.
  requestQueue.forEach((reqObj, index) => {
    requestStatus.set(reqObj.id, { status: "queued", position: index + 1 });
  });
});

// ====================================================
// YouTube Video Download and Transcription
// ====================================================
app.post("/youtube", async (req, res) => {
  const { userId, youtubeUrl, model } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: "Missing userId in the request." });
  }
  if (!loggedInUsers.has(userId)) {
    return res.status(400).json({ error: "User not logged in. Please login." });
  }
  if (!youtubeUrl) {
    return res.status(400).json({ error: "Missing YouTube URL." });
  }

  try {
    console.log("Fetching YouTube video info...");
    
    // Get video info using yt-dlp
    const infoCmd = `yt-dlp --print "%(title)s|||%(duration)s" "${youtubeUrl}"`;
    const { stdout: infoOutput } = await execPromise(infoCmd);
    const [rawTitle, durationStr] = infoOutput.trim().split('|||');
    
    const videoTitle = rawTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const duration = parseFloat(durationStr) || 0;
    const fileName = `${videoTitle}.mp4`;
    const audioPath = path.join(__dirname, "uploads", `${Date.now()}-youtube-audio.mp3`);
    const convertedPath = path.join(__dirname, "uploads", `${Date.now()}-converted.wav`);

    console.log(`Downloading: ${rawTitle}`);
    console.log(`Duration: ${duration}s`);

    // Download audio using yt-dlp
    const downloadCmd = `yt-dlp -x --audio-format mp3 --output "${audioPath}" "${youtubeUrl}"`;
    await execPromise(downloadCmd);

    console.log("Download complete, converting to WAV...");
    
    // Convert to WAV format for Whisper
    const convertCmd = `ffmpeg -i "${audioPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${convertedPath}"`;
    await execPromise(convertCmd);

    // Delete the original MP3
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }

    console.log("Conversion complete, starting transcription...");

    // Run transcription
    const selectedModel = model || "large";
    const id = Date.now().toString();

    await new Promise((resolve, reject) => {
      runCommand(convertedPath, selectedModel, id, res, resolve, reject, userId, fileName, 'video', duration);
    });

  } catch (error) {
    console.error("Error processing YouTube URL:", error);
    res.status(500).json({ error: `Error processing YouTube URL: ${error.message}` });
  }
});

// ====================================================
// History API Endpoints
// ====================================================

// Get all transcription history for a user
app.get("/history/:userId", (req, res) => {
  const { userId } = req.params;
  
  db.all(
    `SELECT id, fileName, fileType, duration, date FROM transcriptions WHERE userId = ? ORDER BY date DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        console.error("Error fetching history:", err.message);
        return res.status(500).json({ error: "Error fetching history." });
      }
      res.json({ history: rows });
    }
  );
});

// Get specific transcription details
app.get("/transcription/:id", (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT * FROM transcriptions WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error("Error fetching transcription:", err.message);
        return res.status(500).json({ error: "Error fetching transcription." });
      }
      if (!row) {
        return res.status(404).json({ error: "Transcription not found." });
      }
      res.json(row);
    }
  );
});

// Delete a transcription
app.delete("/transcription/:id", (req, res) => {
  const { id } = req.params;
  
  db.run(
    `DELETE FROM transcriptions WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        console.error("Error deleting transcription:", err.message);
        return res.status(500).json({ error: "Error deleting transcription." });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Transcription not found." });
      }
      res.json({ message: "Transcription deleted successfully." });
    }
  );
});

app.post("/userExpire", (req, res) => {
  const userId = req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId in the request." });
  }
  if (!loggedInUsers.has(userId)) {
    return res
      .status(400)
      .json({ error: "User not logged in." });
  }

  loggedInUsers.delete(userId);
  console.log("User session expired: ", userId);
  res.status(200).json({ message: "User session expired." });
});


// Listen for process termination signals and uncaught exceptions
process.on("SIGINT", () => {
  console.log("Received SIGINT.");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM.");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

// ====================================================
// Start the Server (listens on PORT 5001)
// ====================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

