import React, { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = location.hash || window.location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const sessionId = decodeURIComponent(match[1]);
    api.post("/auth/google/session", { session_id: sessionId })
      .then((r) => {
        setUser(r.data);
        // strip hash and go to dashboard
        window.history.replaceState({}, document.title, "/dashboard");
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        navigate("/login?error=oauth", { replace: true });
      });
  }, [location.hash, navigate, setUser]);

  return (
    <div className="min-h-[60vh] grid place-items-center" data-testid="auth-callback-page">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 border-2 border-[#EAE5D9] border-t-[#C26D53] rounded-full animate-spin"/>
        <p className="mt-4 text-[#5C6670]">Signing you in…</p>
      </div>
    </div>
  );
}
