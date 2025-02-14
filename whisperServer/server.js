const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { exec, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const app = express();
const PORT = 5000; // This port is used when running the server on the host machine

app.use(cors());
app.use(express.json());

// ====================================================
// In-Memory User Management (for Demo)
// ====================================================
const users = {
  "user123456": { password: "secret1" },
  "user654321": { password: "secret2" },
};

// Mapping from userId to container name
const userContainers = {};

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

  // Create a lightweight Docker container for this user.
  // The container is run detached with a shared volume for uploads.
  // Adjust the image name ("veto-image-1") as needed.
  const containerName = `container_${userId}`;
  const uploadsPath = path.join(__dirname, "uploads");
  const dockerRunCmd = `sudo docker run -d --name ${containerName} -v ${uploadsPath}:/uploads veto-image-1`;

  exec(dockerRunCmd, (err, stdout, stderr) => {
    if (err) {
      console.error("Error creating container:", err);
      return res.status(500).json({ message: "Error creating container." });
    }
    // Store the container name for later reference
    userContainers[userId] = containerName;
    res.json({
      message: "Login successful. Container created.",
      userId,
    });
    console.log("Container Created: ", containerName);
  });
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

  // Destroy the user's container
  const containerName = userContainers[userId];
  if (!containerName) {
    return res.status(400).json({ message: "No container found for user." });
  }
  const dockerStopCmd = `sudo docker rm -f ${containerName}`;
  exec(dockerStopCmd, (err, stdout, stderr) => {
    if (err) {
      console.error("Error deleting container:", err);
      return res.status(500).json({ message: "Error deleting container." });
    }
    // Remove container mapping
    delete userContainers[userId];
    res.json({ message: "Logout successful. Container destroyed." });
  });
  console.log("Container destroyed: ", containerName);
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

let globalSettings = {
  temperature: 0.0,
  best_of: 5,
  condition_on_previous_text: "True",
  threads: 0,
  no_speech_threshold: 0.6,
  compression_ratio_threshold: 2.4,
  device: "cpu",
  fp16: "True",
};

// Endpoint to update settings
app.post("/settings", (req, res) => {
  const {
    temperature,
    best_of,
    condition_on_previous_text,
    no_speech_threshold,
    threads,
    compression_ratio_threshold,
    device,
    fp16,
  } = req.body;

  if (temperature !== undefined) globalSettings.temperature = temperature;
  if (best_of !== undefined) globalSettings.best_of = best_of;
  if (condition_on_previous_text !== undefined)
    globalSettings.condition_on_previous_text = condition_on_previous_text;
  if (no_speech_threshold !== undefined)
    globalSettings.no_speech_threshold = no_speech_threshold;
  if (threads !== undefined) globalSettings.threads = threads;
  if (compression_ratio_threshold !== undefined)
    globalSettings.compression_ratio_threshold = compression_ratio_threshold;
  if (device !== undefined) globalSettings.device = device;
  if (fp16 !== undefined) globalSettings.fp16 = fp16;

  res.json({ message: "Settings updated successfully", settings: globalSettings });
});

// Endpoint to fetch current settings
app.get("/settings", (req, res) => {
  res.json({ settings: globalSettings });
});

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
    const outputFilePath = `uploads/${Date.now()}-converted.wav`;
    const selectedModel = req.body.model || "large";

    await new Promise((resolve, reject) => {
      // Run ffprobe to check audio format (on host)
      exec(`ffprobe -i ${filePath} -show_streams -select_streams a -of json`, (err, stdout) => {
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
            runCommand(filePath, selectedModel, id, res, resolve, reject, userId);
          } else {
            // Convert the file if needed
            exec(`ffmpeg -i ${filePath} -ar 16000 -ac 1 -c:a pcm_s16le ${outputFilePath}`, (convertErr) => {
              if (convertErr) {
                metrics.errorLogs.push({ error: convertErr.message, timestamp: new Date() });
                console.error("Error converting file:", convertErr);
                return reject(new Error("Error converting file."));
              }
              fs.unlinkSync(filePath);
              runCommand(outputFilePath, selectedModel, id, res, resolve, reject, userId);
            });
          }
        } catch (parseErr) {
          console.error("Error parsing ffprobe output:", parseErr);
          return reject(new Error("Error processing file metadata."));
        }
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

const runCommand = (filePath, model, id, res, resolve, reject, userId) => {
  const {
    temperature,
    best_of,
    condition_on_previous_text,
    threads,
    no_speech_threshold,
    compression_ratio_threshold,
    device,
    fp16,
  } = globalSettings;

  const params = [
    `--temperature ${temperature}`,
    best_of ? `--best_of ${best_of}` : "",
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
  const command = `whisper ${filePath} --model ${model} --task translate ${params}`;

  exec(command, (err, stdout) => {
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

    // Look up the user's container
    const containerName = userContainers[userId];
    if (!containerName) {
      console.error("Container not found for user:", userId);
      metrics.failedRequests++;
      requestStatus.set(id, { status: "failed", position: null });
      if (!res.headersSent) {
        res.status(400).json({ error: "User container not found." });
      }
      return reject(new Error("User container not found."));
    }

    // Execute a command inside the container that echoes the transcription.
    const dockerSendCmd = `sudo docker exec ${containerName} echo "Transcription: ${cleanedOutput}"`;
    exec(dockerSendCmd, (execErr, execStdout, execStderr) => {
      if (execErr) {
        console.error("Error sending transcription to container:", execErr);
        metrics.failedRequests++;
        requestStatus.set(id, { status: "failed", position: null });
        if (!res.headersSent) {
          res.status(500).json({ error: "Error sending transcription to container." });
        }
        return reject(new Error("Error sending transcription to container."));
      } else {
        console.log("Transcription sent to container:", containerName);
        console.log(cleanedOutput);
        metrics.successfulRequests++;
        metrics.activeRequests--;
        metrics.requestLogs.push({
          id,
          text: `Transcription sent to container: ${containerName}`,
          timestamp: new Date(),
        });
        requestStatus.set(id, { status: "completed", position: null });
        // Return the echo output from the container.
        if (!res.headersSent) {
          res.json({ transcription: execStdout.trim(), id });
        }
        return resolve();
      }
    });
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
  if (!userContainers[userId]) {
    return res
      .status(400)
      .json({ error: "User container not found. Please login." });
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
// Cleanup Function: Remove all running containers on exit
// ====================================================
const cleanupContainers = () => {
  console.log("Cleaning up running containers...");
  // Iterate through containers created by the server
  Object.values(userContainers).forEach((containerName) => {
    try {
      execSync(`sudo docker rm -f ${containerName}`, { stdio: "inherit" });
      console.log(`Container ${containerName} removed.`);
    } catch (err) {
      console.error(`Error removing container ${containerName}:`, err.message);
    }
  });
};

const cleanupUniqueContainer = (containerName) => {
  console.log(`Destroying Container: ${containerName}`);

    try {
      execSync(`sudo docker rm -f ${containerName}`, { stdio: "inherit" });
      console.log(`Container ${containerName} removed.`);
    } catch (err) {
      console.error(`Error removing container ${containerName}:`, err.message);
    }
};

app.post("/userExpire", (req, res) => {
  const userId = req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId in the request." });
  }
  if (!userContainers[userId]) {
    return res
      .status(400)
      .json({ error: "User container not found. Please login." });
  }

  cleanupUniqueContainer(`container_${userId}`)
  res.status(200).json({ message: "User session expired." });
});


// Listen for process termination signals and uncaught exceptions
process.on("SIGINT", () => {
  console.log("Received SIGINT.");
  cleanupContainers();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM.");
  cleanupContainers();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  cleanupContainers();
  process.exit(1);
});

// Also clean up on normal exit (synchronous handlers only)
process.on("exit", () => {
  cleanupContainers();
});

// ====================================================
// Start the Server (listens on PORT 5000)
// ====================================================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
