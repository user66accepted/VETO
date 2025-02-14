import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

const MainPage = lazy(() => import("./components/pages/MainPage.jsx"));
const SignIn = lazy(() => import("./components/pages/SignIn.jsx"));
const Admin = lazy(() => import("./components/admin/AdminPanel.jsx"));

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/SignIn" />;
};

const App = () => {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/SignIn" element={<SignIn />} />
          <Route path="/" element={<ProtectedRoute><MainPage /></ProtectedRoute>} />
          <Route path="/Admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
