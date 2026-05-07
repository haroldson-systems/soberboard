import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { formatApiError } from "@/lib/api";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="max-w-md mx-auto px-5 py-16" data-testid="register-page">
      <p className="sb-overline">Create a free account</p>
      <h1 className="mt-3 font-serif text-4xl text-[#2D3339]">Sign up</h1>
      <p className="mt-3 text-[#5C6670]">Free forever for house managers and operators. No credit card.</p>

      <button onClick={onGoogle} className="mt-8 w-full border border-[#EAE5D9] rounded-full px-6 py-3 font-medium hover:border-[#C26D53] hover:text-[#C26D53] transition flex items-center justify-center gap-3" data-testid="google-register-btn">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.13 4.13 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.34 0-4.33-1.58-5.04-3.7H.96v2.32A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.27-1.71V4.96H.96A8.997 8.997 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.997 8.997 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>
        Continue with Google
      </button>

      <div className="my-7 flex items-center gap-3 text-xs text-[#8A94A0]">
        <div className="flex-1 h-px bg-[#EAE5D9]"/> OR <div className="flex-1 h-px bg-[#EAE5D9]"/>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="sb-input" data-testid="register-name-input"/>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="sb-input" data-testid="register-email-input"/>
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 chars)" className="sb-input" data-testid="register-password-input"/>
        {error && <p className="text-sm text-[#C26D53]" data-testid="register-error">{error}</p>}
        <button type="submit" disabled={loading} className="sb-btn-primary w-full" data-testid="register-submit-btn">
          {loading ? "Creating…" : "Create free account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[#5C6670]">
        Already have an account? <Link to="/login" className="text-[#C26D53] font-semibold" data-testid="register-to-login-link">Sign in</Link>
      </p>
    </div>
  );
}
