/**
 * Style system: ClashOfCode Tournament Console — account creation mirrors the public hero’s
 * decisive arena language and exposes validation directly where new players need it.
 */
import PublicShell from "@/components/PublicShell";
import { ArrowRight, Crosshair, Sparkles, Github, Mail, Eye, EyeOff } from "lucide-react";
import { FormEvent, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

type Errors = { username?: string; email?: string; password?: string; confirm?: string; dateOfBirth?: string; general?: string };
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function Signup() {
  const [, setLocation] = useLocation();
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<{ github: boolean; google: boolean }>({ github: false, google: false });
  
  useEffect(() => {
    api.get("/auth/oauth/providers").then(r => setOauthProviders(r.data)).catch(() => {});
  }, []);
  
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {};
    if (!username.trim()) next.username = "Username is required.";
    else if (username.trim().length < 3) next.username = "Use at least 3 characters.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!validEmail(email)) next.email = "Enter a valid email address.";
    if (!password) next.password = "Password is required.";
    else if (password.length < 8) next.password = "Use at least 8 characters.";
    if (!confirm) next.confirm = "Confirm your password.";
    else if (password !== confirm) next.confirm = "Passwords do not match.";
    if (!dateOfBirth) next.dateOfBirth = "Date of birth is required.";
    else {
      const dob = new Date(dateOfBirth);
      const ageLimit = new Date();
      ageLimit.setFullYear(ageLimit.getFullYear() - 13);
      if (dob > ageLimit) {
        next.dateOfBirth = "You must be at least 13 years old.";
      }
    }
    setErrors(next);
    
    if (Object.keys(next).length > 0) return;
    
    setIsSubmitting(true);
    try {
      const response = await api.post("/auth/signup", { username, email, password, dateOfBirth });
      if (response.data?.accessToken) {
        localStorage.setItem("token", response.data.accessToken);
        if (response.data?.refreshToken) {
          localStorage.setItem("refreshToken", response.data.refreshToken);
        }
        // Set user in AuthContext
        if (response.data?.user) {
          setUser(response.data.user);
        }
        setLocation("/app");
      } else {
        setErrors({ general: "Invalid response from server." });
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || "Registration failed. Try again.";
      setErrors({ general: errMsg });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return <PublicShell authView="signup">
    <main className="auth-stage">
      <section className="auth-story">
        <p className="section-kicker">Arena entry / new player</p>
        <h1>Make your<br /><em>first move.</em></h1>
        <p>Create a player identity, start in the practice range, then make the ladder yours.</p>
        <div className="auth-stat">
          <Sparkles className="h-5 w-5 text-[#b5df73]" />
          <span>YOUR ENTRY PACKAGE<br /><b>STARTER RATING / OPEN PRACTICE</b></span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-heading">
          <span className="auth-sigil"><Crosshair className="h-5 w-5" /></span>
          <div>
            <p className="section-kicker">Set your handle</p>
            <h2>Enter the arena.</h2>
          </div>
        </div>
        <form noValidate onSubmit={submit} className="auth-form">
          {errors.general && <div className="field-error text-center mb-4 p-2 bg-red-950/20 border border-red-500/30 rounded text-red-400">{errors.general}</div>}
          <label>Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" aria-invalid={Boolean(errors.username)} className={errors.username ? "is-invalid" : ""} placeholder="Choose a player name" />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </label>
          <label>Email address
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} className={errors.email ? "is-invalid" : ""} placeholder="you@example.com" />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label>Date of birth
            <input value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} type="date" aria-invalid={Boolean(errors.dateOfBirth)} className={errors.dateOfBirth ? "is-invalid" : ""} />
            {errors.dateOfBirth && <span className="field-error">{errors.dateOfBirth}</span>}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>Password
              <div className="relative">
                <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" aria-invalid={Boolean(errors.password)} className={errors.password ? "is-invalid w-full pr-10" : "w-full pr-10"} placeholder="8+ characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747783] hover:text-[#c9cbd1] transition-colors focus:outline-none" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
            </label>
            <label>Confirm password
              <div className="relative">
                <input value={confirm} onChange={(event) => setConfirm(event.target.value)} type={showConfirm ? "text" : "password"} autoComplete="new-password" aria-invalid={Boolean(errors.confirm)} className={errors.confirm ? "is-invalid w-full pr-10" : "w-full pr-10"} placeholder="Repeat password" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747783] hover:text-[#c9cbd1] transition-colors focus:outline-none" tabIndex={-1}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirm && <span className="field-error">{errors.confirm}</span>}
            </label>
          </div>
          <div className="flex justify-end">
            <button className="primary-button" type="submit">Create account <ArrowRight className="h-4 w-4" /></button>
          </div>
        </form>
        <p className="auth-switch">Already in the arena? <Link href="/login">Log in</Link></p>
        <div className="mt-5 border-t border-white/10 pt-5 space-y-2">
          <p className="text-center font-mono text-[10px] text-[#747783] tracking-[.12em] mb-3">OR CONTINUE WITH</p>
          <a href={oauthProviders.github ? `${API_BASE}/auth/oauth/github` : "#"} className={`flex w-full items-center justify-center gap-2 rounded border border-white/15 bg-white/[.04] py-2.5 text-sm font-medium text-white transition-colors ${!oauthProviders.github ? "opacity-40 pointer-events-none" : "hover:bg-white/10"}`}>
            <Github className="h-4 w-4" /> GitHub {!oauthProviders.github && <span className="text-[10px] text-[#747783] font-mono ml-1">(Not configured)</span>}
          </a>
          <a href={oauthProviders.google ? `${API_BASE}/auth/oauth/google` : "#"} className={`flex w-full items-center justify-center gap-2 rounded border border-white/15 bg-white/[.04] py-2.5 text-sm font-medium text-white transition-colors ${!oauthProviders.google ? "opacity-40 pointer-events-none" : "hover:bg-white/10"}`}>
            <Mail className="h-4 w-4" /> Google {!oauthProviders.google && <span className="text-[10px] text-[#747783] font-mono ml-1">(Not configured)</span>}
          </a>
        </div>
      </section>
    </main>
  </PublicShell>;
}
