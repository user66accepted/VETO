import React, { useState, useEffect } from "react";
import { FaUserAlt, FaLock } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { login, logout } from "../../../redux/authSlice"; // Import Redux actions
import MainPage from "./MainPage";

function SignIn() {
  const [userID, setUserID] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [containerInfo, setContainerInfo] = useState(null);

  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const sessionExpiresAt = useSelector((state) => state.auth.sessionExpiresAt);

  const handleExpire = async () => {

    try {
      const response = await fetch("http://192.168.15.41:5000/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userID, password: password }),
      });
  
      if (!response.ok) {
        // If the response is not OK, get the error message from the response body.
        const errorData = await response.json();
        console.error("Error expiring user container:", errorData);
        // Optionally, you can display an error message to the user here.
        return;
      }
  
      // If successful, parse and log the JSON data.
      const data = await response.json();
      console.log("User container expired successfully:", data);
      // Optionally, do further processing with the returned data.
  
    } catch (error) {
      console.error("Error in handleExpire:", error);
    }
  };
  

  const handleSignIn = async () => {
    setMessage(""); // Reset message

    try {
      const response = await fetch("http://192.168.15.41:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userID, password: password }),
      });

      const data = await response.json();

      if (response.ok) {
        setContainerInfo(data.container);
        setMessage("Sign In Successful!");

        dispatch(login({ userId: userID, password: password }));

      } else {
        setMessage(data.message || "Invalid User ID or Password.");
      }
    } catch (error) {
      console.error("Error during login:", error);
      setMessage("An error occurred while signing in.");
    }
  };


  if (isAuthenticated) {
    return <MainPage containerInfo={containerInfo} />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      {/* Glassmorphic Login Box */}
      <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl shadow-lg p-8 w-full max-w-md border border-gray-300 border-opacity-30">
        <h2 className="text-3xl font-semibold text-center text-white mb-6">
          Sign In
        </h2>

        {/* User ID Input */}
        <div className="relative w-full mb-4">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <FaUserAlt />
          </span>
          <input
            type="text"
            value={userID}
            onChange={(e) => setUserID(e.target.value)}
            className="w-full pl-10 py-2 border border-gray-500 rounded-md bg-transparent text-white focus:outline-none placeholder-gray-400"
            placeholder="User ID"
          />
        </div>

        {/* Password Input */}
        <div className="relative w-full mb-6">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <FaLock />
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 py-2 border border-gray-500 rounded-md bg-transparent text-white focus:outline-none placeholder-gray-400"
            placeholder="Password"
          />
        </div>

        {/* Sign In Button */}
        <button
          onClick={handleSignIn}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition duration-300"
        >
          Sign In
        </button>

        {/* Message Display */}
        {message && (
          <p
            className={`text-lg font-semibold text-center mt-4 ${
              message === "Sign In Successful!" ? "text-green-400" : "text-red-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default SignIn;
