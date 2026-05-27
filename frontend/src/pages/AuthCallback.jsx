import React, { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const code = searchParams.get("code");
    if (!code) {
      navigate("/login", { replace: true });
      return;
    }

    const redirectUri = window.location.origin + "/auth/callback";
    api.post("/auth/google/callback", { code, redirect_uri: redirectUri })
      .then((r) => {
        setUser(r.data);
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        navigate("/login?error=oauth", { replace: true });
      });
  }, [searchParams, navigate, setUser]);

  return (
    <div className="min-h-[60vh] grid place-items-center" data-testid="auth-callback-page">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 border-2 border-[#EAE5D9] border-t-[#C26D53] rounded-full animate-spin"/>
        <p className="mt-4 text-[#5C6670]">Signing you in…</p>
      </div>
    </div>
  );
}
