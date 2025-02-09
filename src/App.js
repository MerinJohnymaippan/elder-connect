import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Import Gemini SDK
import "./App.css";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZWp7DZazuUXlIW3b5pK_nv_RYK0lv_wc",
  authDomain: "elderconnect-2e526.firebaseapp.com",
  projectId: "elderconnect-2e526",
  storageBucket: "elderconnect-2e526.firebasestorage.app",
  messagingSenderId: "376568614180",
  appId: "1:376568614180:web:f1c6cf9e54b50f169637b1",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Google Gemini API Configuration
const apiKey = "AIzaSyBx5uR7Jc5zPxKdjCvp8lhdq4BLeoyPcJI"; // Ensure this is replaced with your actual API key
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

const App = () => {
  const [userMessage, setUserMessage] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const [emotion, setEmotion] = useState("");
  const [reminders, setReminders] = useState({
    foodTime: "08:00",
    waterTime: "10:00",
    medicineTime: "12:00",
    sleepTime: "22:00",
  });
  const [showSleepReminder, setShowSleepReminder] = useState(false);
  const [reminderAlert, setReminderAlert] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  // Memoize the recognition object to avoid recreating it on every render
  const recognition = useMemo(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return SpeechRecognition ? new SpeechRecognition() : null;
  }, []);

  useEffect(() => {
    if (recognition) {
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        console.log("Speech recognition started...");
      };

      recognition.onend = () => {
        console.log("Speech recognition ended.");
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[event.resultIndex][0].transcript;
        console.log("Recognized speech:", transcript);
        setUserMessage(transcript);
      };
    }

    // Set up timers to check the reminders every minute
    const intervalId = setInterval(() => {
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();

      // Check food reminder
      const [foodHour, foodMinute] = reminders.foodTime.split(":").map(Number);
      if (currentHour === foodHour && currentMinute === foodMinute) {
        setReminderAlert("Time to eat your food!");
      }

      // Check water reminder
      const [waterHour, waterMinute] = reminders.waterTime.split(":").map(Number);
      if (currentHour === waterHour && currentMinute === waterMinute) {
        setReminderAlert("Time to drink some water!");
      }

      // Check medicine reminder
      const [medicineHour, medicineMinute] = reminders.medicineTime.split(":").map(Number);
      if (currentHour === medicineHour && currentMinute === medicineMinute) {
        setReminderAlert("Time to take your medicine!");
      }

      // Check sleep reminder
      const [sleepHour] = reminders.sleepTime.split(":").map(Number);
      if (currentHour >= sleepHour) {
        setShowSleepReminder(true);
      } else {
        setShowSleepReminder(false);
      }
    }, 60000); // Check every minute

    // Cleanup the interval when the component is unmounted
    return () => clearInterval(intervalId);
  }, [recognition, reminders]);

  // Handle setting reminder times
  const handleSetReminder = (e) => {
    const { name, value } = e.target;
    setReminders((prevReminders) => ({
      ...prevReminders,
      [name]: value,
    }));
  };

  // Function to handle sending message and getting AI response
  const handleSendMessage = async () => {
    if (!userMessage) return;

    try {
      // Add user message to chat history
      setChatHistory((prevHistory) => [
        ...prevHistory,
        { sender: "user", message: userMessage },
      ]);

      // Make request to the Google Gemini API (AI Chatbot)
      const chatSession = model.startChat({
        generationConfig,
        history: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
      });

      const result = await chatSession.sendMessage(userMessage);
      const aiResponse = result.response.text() || "I'm here to help!";
      setChatResponse(aiResponse);

      // Add AI response to chat history
      setChatHistory((prevHistory) => [
        ...prevHistory,
        { sender: "ai", message: aiResponse },
      ]);

      // Simple Emotion Detection based on user input
      let detectedEmotion = "Neutral";
      if (userMessage.includes("sad") || userMessage.includes("depressed")) {
        detectedEmotion = "Sad";
      } else if (userMessage.includes("happy") || userMessage.includes("excited")) {
        detectedEmotion = "Happy";
      } else if (userMessage.includes("anxious") || userMessage.includes("stressed")) {
        detectedEmotion = "Anxious";
      }

      setEmotion(detectedEmotion);

      // Store Emotion in Firebase (real-time database)
      const userRef = ref(database, "users/elder1");
      set(userRef, {
        emotion: detectedEmotion,
        lastMessage: userMessage,
        timestamp: new Date().toISOString(),
      });

      // Voice Output for AI Response
      const utterance = new SpeechSynthesisUtterance(aiResponse);
      window.speechSynthesis.speak(utterance);

    } catch (error) {
      console.error("Error communicating with AI:", error);
    }
  };

  // Start voice recognition on button click
  const startVoiceInput = () => {
    if (recognition) {
      recognition.start();
    }
  };

  // Function to get the next reminder
  const getNextReminder = () => {
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    
    const remindersList = [
      { label: "Food", time: reminders.foodTime },
      { label: "Water", time: reminders.waterTime },
      { label: "Medicine", time: reminders.medicineTime },
      { label: "Sleep", time: reminders.sleepTime },
    ];

    // Sort reminders by the time of day
    remindersList.sort((a, b) => {
      const [aHour, aMinute] = a.time.split(":").map(Number);
      const [bHour, bMinute] = b.time.split(":").map(Number);

      const aTime = aHour * 60 + aMinute;
      const bTime = bHour * 60 + bMinute;

      return aTime - bTime;
    });

    for (let reminder of remindersList) {
      const [reminderHour, reminderMinute] = reminder.time.split(":").map(Number);
      if (reminderHour > currentHour || (reminderHour === currentHour && reminderMinute > currentMinute)) {
        return `Next reminder: ${reminder.label} at ${reminder.time}`;
      }
    }

    return "No more reminders for today!";
  };

  return (
    <div className="container">
      <h1>AI Emotional Support Companion</h1>
      <div className="chat-box">
        <div className="chat-history">
          {chatHistory.map((chat, index) => (
            <div
              key={index}
              className={chat.sender === "user" ? "user-message" : "ai-message"}
            >
              <p>{chat.message}</p>
            </div>
          ))}
        </div>

        <div className="input-box">
          <textarea
            placeholder="How are you feeling today?"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
          />
        </div>
        <button className="send-btn" onClick={handleSendMessage}>
          Send
        </button>
        <button className="voice-btn" onClick={startVoiceInput}>
          🎤
        </button>
      </div>

      {/* Display AI Response and Emotion */}
      {chatResponse && (
        <div className="response-box">
          <h3>AI Response:</h3>
          <p>{chatResponse}</p>
        </div>
      )}
      {emotion && (
        <div className="response-box">
          <h4>Detected Emotion: {emotion}</h4>
        </div>
      )}

      {/* Reminder alerts */}
      {reminderAlert && (
        <div className="reminder-box">
          <p>{reminderAlert}</p>
        </div>
      )}

      {showSleepReminder && (
        <div className="reminder-box">
          <p>It's getting late. You should consider going to sleep soon!</p>
        </div>
      )}

      {/* Reminder Inputs */}
      <div className="reminders-section">
        <h3>Set Your Reminders</h3>

        <div>
          <label>Food Reminder Time</label>
          <input
            type="time"
            name="foodTime"
            value={reminders.foodTime}
            onChange={handleSetReminder}
          />
        </div>

        <div>
          <label>Water Reminder Time</label>
          <input
            type="time"
            name="waterTime"
            value={reminders.waterTime}
            onChange={handleSetReminder}
          />
        </div>

        <div>
          <label>Medicine Reminder Time</label>
          <input
            type="time"
            name="medicineTime"
            value={reminders.medicineTime}
            onChange={handleSetReminder}
          />
        </div>

        <div>
          <label>Sleep Reminder Time</label>
          <input
            type="time"
            name="sleepTime"
            value={reminders.sleepTime}
            onChange={handleSetReminder}
          />
        </div>
      </div>

      {/* Display next reminder */}
      <div className="next-reminder-box">
        <p>{getNextReminder()}</p>
      </div>
    </div>
  );
};

export default App;
