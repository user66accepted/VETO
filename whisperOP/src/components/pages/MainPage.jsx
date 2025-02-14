import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../../redux/authSlice"; // Adjust the path as needed

function MainPage() {
  const dispatch = useDispatch();
  const { userId, password } = useSelector((state) => state.auth);

  const [file, setFile] = useState(null);
  const [output, setOutput] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState("large");

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleModelChange = (event) => {
    setSelectedModel(event.target.value);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    setIsProcessing(true);
    setUploadStatus("Uploading file...");
    setOutput("");

    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("audio", file);
    formData.append("model", selectedModel);

    try {
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.transcription) {
          setOutput(data.transcription);
          setUploadStatus("Transcription completed.");
        } else {
          setUploadStatus("No transcription received.");
        }
      } else {
        setUploadStatus("File upload failed.");
      }
    } catch (error) {
      setUploadStatus("An error occurred during upload.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    try {
      dispatch(logout());
      const response = await fetch("http://localhost:5000/logout", {
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
    // Cleanup if needed
    return () => { };
  }, []);

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

            {/* File Input */}
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-600"
            />

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
        </div>

      </main>
    </div>
  );
}

export default MainPage;
