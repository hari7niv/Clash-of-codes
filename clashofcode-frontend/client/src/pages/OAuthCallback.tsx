/**
 * OAuthCallback — handles the redirect from the backend after OAuth login.
 * The backend sends: /oauth/callback?token=...&refreshToken=...
 * We store the tokens and navigate to the app.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const refreshToken = params.get("refreshToken");
    const error = params.get("error");

    if (error) {
      setLocation(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token) {
      localStorage.setItem("token", token);
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      }
      // Hard-reload to reinitialize AuthContext with the new token
      window.location.href = "/app";
    } else {
      setLocation("/login?error=oauth_failed");
    }
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0b0d]">
      <div className="text-center">
        <div className="text-2xl mb-2">⚔️</div>
        <p className="text-[#848792]">Signing you in…</p>
      </div>
    </div>
  );
}
