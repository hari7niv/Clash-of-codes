import PublicShell from "@/components/PublicShell";
import { ArrowRight, KeyRound, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { FormEvent, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { api } from "@/lib/api";

export default function ResetPassword() {
  const [location] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Extract token from query params
    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get("token");
    setToken(tokenParam);
  }, [location]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    
    if (!token) {
      setErrorMessage("Invalid or missing reset token.");
      setStatus("error");
      return;
    }
    
    if (!password) {
      setErrorMessage("Password is required.");
      setStatus("error");
      return;
    }
    
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      setStatus("error");
      return;
    }
    
    if (password !== confirm) {
      setErrorMessage("Passwords do not match.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setStatus("success");
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Failed to reset password. The link might be expired.";
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  if (!token) {
    return (
      <PublicShell authView="login">
        <main className="auth-stage">
          <section className="auth-story">
            <p className="section-kicker">Account recovery</p>
            <h1>Regain<br /><em>access.</em></h1>
          </section>
          <section className="auth-panel">
            <div className="auth-panel-heading">
              <span className="auth-sigil"><KeyRound className="h-5 w-5" /></span>
              <div>
                <p className="section-kicker">Error</p>
                <h2>Invalid link</h2>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <p className="text-sm text-[#989ba5] mb-6">
                This password reset link is invalid or has expired.
              </p>
              <Link href="/forgot-password" className="primary-button w-full justify-center">
                Request new link
              </Link>
            </div>
          </section>
        </main>
      </PublicShell>
    );
  }

  return (
    <PublicShell authView="login">
      <main className="auth-stage">
        <section className="auth-story">
          <p className="section-kicker">Account recovery</p>
          <h1>Secure<br /><em>access.</em></h1>
          <p>Choose a strong new password to protect your rating and progress.</p>
        </section>
        <section className="auth-panel">
          <div className="auth-panel-heading">
            <span className="auth-sigil"><KeyRound className="h-5 w-5" /></span>
            <div>
              <p className="section-kicker">Security</p>
              <h2>Reset password</h2>
            </div>
          </div>

          {status === "success" ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 rounded-full bg-[#b5df73]/20 p-3 text-[#b5df73]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mb-2 font-display text-xl font-bold">Password updated</h3>
              <p className="text-sm text-[#989ba5] mb-6">
                Your password has been successfully reset.
              </p>
              <Link href="/login" className="primary-button w-full justify-center">
                Continue to Login <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="auth-form">
              {status === "error" && (
                <div className="field-error text-center mb-4 p-2 bg-red-950/20 border border-red-500/30 rounded text-red-400">
                  {errorMessage}
                </div>
              )}
              
              <label>New password
                <div className="relative">
                  <input 
                    value={password} 
                    onChange={(event) => setPassword(event.target.value)} 
                    type={showPassword ? "text" : "password"} 
                    autoComplete="new-password" 
                    className="w-full pr-10" 
                    placeholder="8+ characters" 
                    disabled={status === "submitting"}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747783] hover:text-[#c9cbd1] transition-colors focus:outline-none" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label>Confirm new password
                <div className="relative">
                  <input 
                    value={confirm} 
                    onChange={(event) => setConfirm(event.target.value)} 
                    type={showConfirm ? "text" : "password"} 
                    autoComplete="new-password" 
                    className="w-full pr-10" 
                    placeholder="Repeat password" 
                    disabled={status === "submitting"}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747783] hover:text-[#c9cbd1] transition-colors focus:outline-none" tabIndex={-1}>
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <div className="mt-4 flex items-center justify-between gap-3">
                <Link href="/login" className="auth-link">Cancel</Link>
                <button className="primary-button" type="submit" disabled={status === "submitting"}>
                  {status === "submitting" ? "Updating..." : "Update password"} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </PublicShell>
  );
}
