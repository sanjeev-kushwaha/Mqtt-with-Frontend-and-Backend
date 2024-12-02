const express = require("express");
const mqtt = require("mqtt");
const path = require("path");
const app = express();
const multer = require("multer");
const fs = require("fs");

app.use(express.json());
const port = 1899;
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

let client = null;
let isConnected = false;

app.post("/connect", (req, res) => {
  const { host, port, username, password } = req.body;

  if (!host || !port || !username || !password) {
    return res
      .status(400)
      .send("Host, port, username, and password are required");
  }

  if (client && isConnected) {
    return res.status(400).send("Already connected to MQTT broker");
  }

  const brokerUrl = `mqtt://${host}:${port}`;
  const options = {
    username,
    password,
  };

  client = mqtt.connect(brokerUrl, options);

  client.on("connect", () => {
    isConnected = true;
    console.log(`Connected to MQTT broker at ${host}:${port}`);
    res.status(200).send("Connected to MQTT broker successfully");
  });

  client.on("error", (err) => {
    isConnected = false;
    console.log(`Connection failed: ${err}`);
    res.status(500).send("Failed to connect to MQTT broker");
  });

  client.on("close", () => {
    isConnected = false;
    console.log("MQTT connection closed");
  });
});

app.post("/subscribe", (req, res) => {
  const { topic } = req.body;

  if (!topic) {
    return res.status(400).send("Topic is required");
  }

  if (!isConnected) {
    return res.status(400).send("Not connected to MQTT broker");
  }
  client.subscribe(topic, (err) => {
    if (err) {
      return res.status(500).send("Failed to subscribe to topic");
    }
    console.log(`Subscribed to topic: ${topic}`);
    res.status(200).send(`Subscribed to topic: ${topic}`);
  });
  client.on("message", (topic, message) => {
    console.log(`Received message on topic ${topic}: ${message.toString()}`);
  });
});

app.post("/publish", (req, res) => {
  const { topic, value } = req.body;

  if (!topic || value === undefined) {
    return res.status(400).send("Topic and value (0 or 1) are required");
  }

  if (value !== 0 && value !== 1) {
    return res.status(400).send("Value must be 0 or 1");
  }
  if (!isConnected) {
    return res.status(400).send("Not connected to MQTT broker");
  }
  const message = value.toString();
  client.publish(topic, message, (err) => {
    if (err) {
      return res.status(500).send("Failed to publish message");
    }
    console.log(`Published value ${message} to topic ${topic}`);
    res.status(200).send(`Published value ${message} to topic ${topic}`);
  });
});

const uploadDir = path.join(__dirname, "public", "upload", "bin");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });
app.use(express.static(path.join(__dirname, "public")));
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  res.status(200).json({
    message: "File uploaded successfully!",
    file: req.file.path,
  });
});

app.listen(port, () => {
  console.log(`MQTT API is running on http://localhost:${port}`);
});
