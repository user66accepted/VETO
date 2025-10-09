import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../../redux/authSlice"; 

function MainPage() {
  const dispatch = useDispatch();
  const { userId, password } = useSelector((state) => state.auth);

  const [file, setFile] = useState(null);
  const [output, setOutput] = useState("");
  const [summary, setSummary] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState("large");
  const [fileType, setFileType] = useState(""); // Track if it's audio or video
  const [history, setHistory] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadMode, setUploadMode] = useState("file"); // "file" or "youtube"

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    
    // Determine file type
    if (selectedFile) {
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      const videoFormats = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'];
      const audioFormats = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'wma'];
      
      if (videoFormats.includes(fileExtension)) {
        setFileType('video');
      } else if (audioFormats.includes(fileExtension)) {
        setFileType('audio');
      } else {
        setFileType('unknown');
      }
    }
  };

  const handleModelChange = (event) => {
    setSelectedModel(event.target.value);
  };

  const handleUpload = async () => {
    if (uploadMode === "file" && !file) {
      alert("Please select a file first.");
      return;
    }

    if (uploadMode === "youtube" && !youtubeUrl) {
      alert("Please enter a YouTube URL.");
      return;
    }

    setIsProcessing(true);
    setOutput("");
    setSummary("");

    if (uploadMode === "youtube") {
      // Handle YouTube URL
      setUploadStatus("Downloading YouTube video...");
      
      try {
        const response = await fetch("http://192.168.15.237:5001/youtube", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            youtubeUrl,
            model: selectedModel,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.transcription) {
            setOutput(data.transcription);
            setSummary(data.summary || "");
            setUploadStatus("Transcription completed.");
            setYoutubeUrl(""); // Clear URL after success
            fetchHistory();
          } else {
            setUploadStatus("No transcription received.");
          }
        } else {
          const errorData = await response.json();
          setUploadStatus(`YouTube processing failed: ${errorData.error || 'Unknown error'}`);
        }
      } catch (error) {
        setUploadStatus("An error occurred during YouTube processing.");
        console.log(error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Handle file upload (existing code)
      if (fileType === 'video') {
        setUploadStatus("Uploading video and extracting audio...");
      } else {
        setUploadStatus("Uploading file...");
      }

      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("audio", file);
      formData.append("model", selectedModel);

      try {
        const response = await fetch("http://192.168.15.237:5001/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.transcription) {
            setOutput(data.transcription);
            setSummary(data.summary || "");
            setUploadStatus("Transcription completed.");
            // Refresh history after successful transcription
            fetchHistory();
          } else {
            setUploadStatus("No transcription received.");
          }
        } else {
          const errorData = await response.json();
          setUploadStatus(`File upload failed: ${errorData.error || 'Unknown error'}`);
        }
      } catch (error) {
        setUploadStatus("An error occurred during upload.");
        console.log(error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`http://192.168.15.237:5001/history/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const handleHistoryItemClick = async (id) => {
    try {
      const response = await fetch(`http://192.168.15.237:5001/transcription/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedHistoryItem(data);
        setOutput(data.transcription);
        setSummary(data.summary || "");
      }
    } catch (error) {
      console.error("Error fetching transcription:", error);
    }
  };

  const handleDeleteHistoryItem = async (id, event) => {
    event.stopPropagation(); // Prevent triggering the click event
    if (window.confirm("Are you sure you want to delete this transcription?")) {
      try {
        const response = await fetch(`http://192.168.15.237:5001/transcription/${id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          fetchHistory();
          if (selectedHistoryItem?.id === id) {
            setSelectedHistoryItem(null);
            setOutput("");
            setSummary("");
          }
        }
      } catch (error) {
        console.error("Error deleting transcription:", error);
      }
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const handleLogout = async () => {
    try {
      dispatch(logout());
      const response = await fetch("http://192.168.15.237:5001/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, password }),
      });

      if (response.ok) {
        dispatch(logout());
      } else {
        console.error("Logout failed.");
      }
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  useEffect(() => {
    // Fetch history when component mounts
    const loadHistory = async () => {
      try {
        const response = await fetch(`http://192.168.15.237:5001/history/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
      }
    };
    
    loadHistory();
    return () => { };
  }, [userId]);

  return (
    <div className="relative min-h-screen text-white">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/back.jpg')", zIndex: -2 }}
      ></div>

      {/* Frosted Blur Effect */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-lg"
        style={{ zIndex: -1 }}
      ></div>

      {/* Logo at Top Left */}
      <img
        src="/logo.png"
        alt="Logo"
        className="absolute top-4 left-4 w-24 h-24 object-contain z-10"
      />

      {/* Logout Button */}
      <button
        className="absolute top-6 right-4 bg-red-500 z-10 p-3 rounded-lg font-bold hover:bg-red-600"
        onClick={handleLogout}
      >
        Logout
      </button>

      {/* History Toggle Button */}
      <button
        className="absolute top-6 right-36 bg-blue-500 z-10 p-3 rounded-lg font-bold hover:bg-blue-600"
        onClick={() => setShowSidebar(!showSidebar)}
      >
        {showSidebar ? "Hide History" : "Show History"}
      </button>

      {/* History Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-gray-900 bg-opacity-95 backdrop-blur-lg shadow-2xl z-20 transform transition-transform duration-300 ease-in-out ${
          showSidebar ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">History</h2>
            <button
              onClick={() => setShowSidebar(false)}
              className="text-white hover:text-red-500 text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {history.length === 0 ? (
              <p className="text-gray-400 text-center mt-8">No history yet</p>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors ${
                    selectedHistoryItem?.id === item.id ? "ring-2 ring-blue-500" : ""
                  }`}
                  onClick={() => handleHistoryItemClick(item.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {item.fileName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.fileType === 'video' ? 'bg-purple-600' : 'bg-green-600'
                        }`}>
                          {item.fileType}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDuration(item.duration)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(item.date)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                      className="ml-2 text-red-500 hover:text-red-700 text-lg"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Heading */}
      <header className="w-full py-6 bg-black bg-opacity-20 backdrop-blur-md">
        <h1 className="text-6xl font-bold text-center">VETO</h1>
        <p className="font-thin text-center italic">
          Voice Enhancement & Translation Offline
        </p>
      </header>

      {/* Main Content: Two Columns */}
      <main className="flex flex-col md:flex-row gap-16 justify-center items-start p-4 relative mt-32">
        {/* Left Side: Upload and Process Card */}
        <div className="w-1/5 bg-gray-100 bg-opacity-20 backdrop-blur-lg rounded-lg shadow-xl p-8">
          <div className="flex flex-col items-center space-y-6">
            <h2 className="text-3xl font-bold text-center">
              Upload and Process
            </h2>
            <p className="text-sm text-gray-300 text-center -mt-2">
              Audio, Video or YouTube
            </p>

            {/* Upload Mode Toggle */}
            <div className="w-full flex gap-2">
              <button
                onClick={() => setUploadMode("file")}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                  uploadMode === "file"
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                File
              </button>
              <button
                onClick={() => setUploadMode("youtube")}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                  uploadMode === "youtube"
                    ? "bg-red-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                YouTube
              </button>
            </div>

            {/* Model Selection */}
            <div className="w-full">
              <label
                htmlFor="model-select"
                className="block text-sm font-medium mb-2"
              >
                Select Model
              </label>
              <select
                id="model-select"
                value={selectedModel}
                onChange={handleModelChange}
                className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 focus:outline-none"
              >
                <option value="tiny">Tiny</option>
                <option value="base">Base</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large (recommended)</option>
                <option value="turbo">Turbo</option>
              </select>
            </div>

            {/* Conditional Input based on mode */}
            {uploadMode === "file" ? (
              <>
                {/* File Input */}
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileChange}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-600"
                />

                {/* File Type Indicator */}
                {file && (
                  <div className="text-sm text-center">
                    <p className="text-gray-300">
                      Selected: <span className="font-semibold text-green-400">{file.name}</span>
                    </p>
                    <p className="text-gray-400 mt-1">
                      Type: <span className="capitalize">{fileType}</span>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* YouTube URL Input */}
                <div className="w-full">
                  <label
                    htmlFor="youtube-url"
                    className="block text-sm font-medium mb-2"
                  >
                    YouTube URL
                  </label>
                  <input
                    id="youtube-url"
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              className={`px-6 py-2 rounded-md font-semibold text-white bg-green-600 hover:bg-green-700 transition-all duration-300 ${isProcessing ? "cursor-not-allowed opacity-70" : ""
                }`}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.964 7.964 0 014 12H0c0 2.042.618 3.934 1.691 5.515l1.309-1.224z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                "Process"
              )}
            </button>

            {/* Upload Status */}
            {uploadStatus && (
              <p className="text-sm p-4 text-gray-400 italic border border-gray-500 rounded-xl">
                {uploadStatus}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Terminal-Like Output */}
        <div className="w-1/3 rounded-lg shadow-xl flex flex-col">
          {/* Info header if history item is selected */}
          {selectedHistoryItem && (
            <div className="bg-gray-800 bg-opacity-50 backdrop-blur-lg rounded-t-md p-4 mb-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-white truncate flex-1">
                  {selectedHistoryItem.fileName}
                </h3>
                <button
                  onClick={() => {
                    setSelectedHistoryItem(null);
                    setOutput("");
                    setSummary("");
                  }}
                  className="text-gray-400 hover:text-white ml-2"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-4 text-sm text-gray-300">
                <span className={`px-2 py-1 rounded ${
                  selectedHistoryItem.fileType === 'video' ? 'bg-purple-600' : 'bg-green-600'
                }`}>
                  {selectedHistoryItem.fileType}
                </span>
                <span>Duration: {formatDuration(selectedHistoryItem.duration)}</span>
                <span>{formatDate(selectedHistoryItem.date)}</span>
              </div>
            </div>
          )}
          
          <div className="bg-gray-700 bg-opacity-30 backdrop-blur-lg rounded-md p-4 overflow-y-auto h-96">
            {output ? (
              <pre className="text-yellow-500 font-mono whitespace-pre-wrap">
                {output}
              </pre>
            ) : (
              <p className="text-gray-200">
                Transcription output will appear here...
              </p>
            )}
          </div>

          {/* AI Summary Box - Glassmorphic Design */}
          {summary && (
            <div className="mt-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-xl rounded-xl p-6 shadow-2xl border border-white/20">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-bold text-white">Summary</h3>
              </div>
              <div className="rounded-lg p-2">
                <p className="text-blue-300 font-bold leading-relaxed">
                  {summary}
                </p>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export default MainPage;
