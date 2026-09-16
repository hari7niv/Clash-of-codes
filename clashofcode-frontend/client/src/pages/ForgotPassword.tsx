import PublicShell from "@/components/PublicShell";
import { ArrowRight, KeyRound, CheckCircle2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { api } from "@/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage("Please enter a valid email address.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    try {
      await api.post("/auth/forgot-password", { email });
      setStatus("success");
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Failed to send reset email. Please try again.";
      setErrorMessage(msg);
      setStatus("error");
    }
  };

  return (
    <PublicShell authView="login">
      <main className="auth-stage">
        <section className="auth-story">
          <p className="section-kicker">Account recovery</p>
          <h1>Regain<br /><em>access.</em></h1>
          <p>Request a secure link to reset your credentials and get back in the game.</p>
        </section>
        <section className="auth-panel">
          <div className="auth-panel-heading">
            <span className="auth-sigil"><KeyRound className="h-5 w-5" /></span>
            <div>
              <p className="section-kicker">Security</p>
              <h2>Forgot your password?</h2>
            </div>
          </div>

          {status === "success" ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 rounded-full bg-[#b5df73]/20 p-3 text-[#b5df73]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mb-2 font-display text-xl font-bold">Check your email</h3>
              <p className="text-sm text-[#989ba5] mb-6">
                We've sent a password reset link to <strong>{email}</strong>.
              </p>
              <Link href="/login" className="secondary-button w-full justify-center">
                Return to login
              </Link>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="auth-form">
              {status === "error" && (
                <div className="field-error text-center mb-4 p-2 bg-red-950/20 border border-red-500/30 rounded text-red-400">
                  {errorMessage}
                </div>
              )}
              
              <p className="text-sm text-[#989ba5] mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              
              <label>
                Email address
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  aria-invalid={status === "error"}
                  className={status === "error" ? "is-invalid" : ""}
                  placeholder="you@example.com"
                  disabled={status === "submitting"}
                />
              </label>

              <div className="mt-2 flex items-center justify-between gap-3">
                <Link href="/login" className="auth-link">Back to login</Link>
                <button className="primary-button" type="submit" disabled={status === "submitting"}>
                  {status === "submitting" ? "Sending..." : "Send link"} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </PublicShell>
  );
}
