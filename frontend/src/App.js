import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import Landing from "@/pages/Landing";
import BedsDirectory from "@/pages/BedsDirectory";
import ListingDetail from "@/pages/ListingDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import PostListing from "@/pages/PostListing";
import JobsBoard from "@/pages/JobsBoard";
import Services from "@/pages/Services";
import About from "@/pages/About";

function AppRouter() {
  const location = useLocation();
  // Synchronous check to handle Emergent OAuth callback BEFORE normal routes
  if (location.hash?.includes("session_id=") || (typeof window !== "undefined" && window.location.hash?.includes("session_id="))) {
    return <AuthCallback />;
  }
  return (
    <>
      <Header />
      <main className="App">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/beds" element={<BedsDirectory />} />
          <Route path="/beds/:id" element={<ListingDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/post" element={<PostListing />} />
          <Route path="/jobs" element={<JobsBoard />} />
          <Route path="/services" element={<Services />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
