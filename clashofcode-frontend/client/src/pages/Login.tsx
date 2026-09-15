/**
 * Style system: ClashOfCode Tournament Console — the login form is a concise arena entry
 * panel with direct validation and familiar competition signals, never a detached generic form.
 */
import PublicShell from "@/components/PublicShell";
import { ArrowRight, Github, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

type Errors = { email?: string; password?: string; general?: string };
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<{ github: boolean; google: boolean }>({ github: false, google: false });
  
  useEffect(() => {
    api.get("/auth/oauth/providers").then(r => setOauthProviders(r.data)).catch(() => {});
  }, []);
  
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!validEmail(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    
    if (Object.keys(next).length > 0) return;
    
    setIsSubmitting(true);
    try {
      await login(email, password);
      // Check for returnTo parameter
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo");
      setLocation(returnTo && returnTo.startsWith("/") ? decodeURIComponent(returnTo) : "/app");
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || "Invalid credentials or server connection failed.";
      setErrors({ general: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return <PublicShell authView="login">
    <main className="auth-stage">
      <section className="auth-story">
        <p className="section-kicker">Arena entry / member access</p>
        <h1>Pick up the<br /><em>thread.</em></h1>
        <p>Return to your rating, active rooms, and next head-to-head battle.</p>
        <div className="auth-stat">
          <ShieldCheck className="h-5 w-5 text-[#b5df73]" />
          <span>YOUR LAST SESSION<br /><b>+18 RATING / 2 WINS</b></span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-heading">
          <span className="auth-sigil"><KeyRound className="h-5 w-5" /></span>
          <div>
            <p className="section-kicker">Welcome back</p>
            <h2>Log in to your arena.</h2>
          </div>
        </div>
        <form noValidate onSubmit={submit} className="auth-form">
          {errors.general && <div className="field-error text-center mb-4 p-2 bg-red-950/20 border border-red-500/30 rounded text-red-400">{errors.general}</div>}
          <label>Email address
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} className={errors.email ? "is-invalid" : ""} placeholder="you@example.com" />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label>Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} className={errors.password ? "is-invalid" : ""} placeholder="Enter your password" />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </label>
          <div className="flex items-center justify-between gap-3">
            <a href="#forgot-password" className="auth-link">Forgot password?</a>
            <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Logging in..." : "Log in"} <ArrowRight className="h-4 w-4" /></button>
          </div>
        </form>
        <p className="auth-switch">New to ClashOfCode? <Link href="/signup">Create an account</Link></p>
        {(oauthProviders.github || oauthProviders.google) && (
          <div className="mt-5 border-t border-white/10 pt-5 space-y-2">
            <p className="text-center font-mono text-[10px] text-[#747783] tracking-[.12em] mb-3">OR CONTINUE WITH</p>
            {oauthProviders.github && (
              <a href={`${API_BASE}/auth/oauth/github`} className="flex w-full items-center justify-center gap-2 rounded border border-white/15 bg-white/[.04] py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                <Github className="h-4 w-4" /> GitHub
              </a>
            )}
            {oauthProviders.google && (
              <a href={`${API_BASE}/auth/oauth/google`} className="flex w-full items-center justify-center gap-2 rounded border border-white/15 bg-white/[.04] py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                <Mail className="h-4 w-4" /> Google
              </a>
            )}
          </div>
        )}
      </section>
    </main>
  </PublicShell>;
}
