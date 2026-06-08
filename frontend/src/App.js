import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import ScrollToTop from "@/components/ScrollToTop";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import EmergencyBanner from "@/components/EmergencyBanner";

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
import Meetings from "@/pages/Meetings";
import About from "@/pages/About";
import NewRecoveryGuide from "@/pages/NewRecoveryGuide";
import Compare from "@/pages/Compare";
import BusinessPortal from "@/pages/BusinessPortal";

function AppRouter() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <EmergencyBanner />
      <main className="App">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/beds" element={<BedsDirectory />} />
          <Route path="/beds/:id" element={<ListingDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/business" element={<BusinessPortal />} />
          <Route path="/post" element={<PostListing />} />
          <Route path="/jobs" element={<JobsBoard />} />
          <Route path="/services" element={<Services />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/new-to-recovery" element={<NewRecoveryGuide />} />
          <Route path="/compare" element={<Compare />} />
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
