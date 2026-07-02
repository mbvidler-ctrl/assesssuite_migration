import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signup"); // "signup" or "signin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (mode === "signup") {
        await base44.auth.register({ email, password });
      } else {
        await base44.auth.loginViaEmailPassword(email, password);
        window.location.href = "/";
        return;
      }
      navigate("/Dashboard");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* LEFT PANEL */}
      <div className="hidden md:flex md:w-5/12 bg-gradient-to-br from-blue-600 to-blue-800 flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3 mb-3">
          <img
            src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/358c0c514_Logo-Transparent1.png"
            alt="Allied Assess"
            className="h-40 brightness-0 invert"
          />
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Assessment software<br />built for clinicians.
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            Join allied health professionals using AssessSuite Clinical to automate assessments, SOAP notes, and reports.
          </p>
        </div>

        <p className="text-blue-300 text-sm">
          Â© 2026 Assess Suite Pty Ltd Â· ABN 53 694 044 481
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-md space-y-8">

          {/* Mobile logo */}
          <div className="md:hidden flex justify-center">
            <img
              src="https://media.base44.com/images/public/68746e3e91f52664774f3d05/358c0c514_Logo-Transparent1.png"
              alt="Allied Assess"
              className="h-10"
            />
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-slate-500 mt-1">
              {mode === "signup"
                ? "Start your free trial â€” no credit card needed to sign up."
                : "Sign in to access your dashboard."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "signup" ? "Create account â†’" : "Sign in â†’"}
            </button>

            {mode === "signup" && (
              <p className="text-xs text-slate-400 text-center">
                By signing up you agree to our{" "}
                <a href="#" className="text-blue-500 hover:underline">Terms of Service</a>{" "}
                and{" "}
                <a href="#" className="text-blue-500 hover:underline">Privacy Policy</a>.
              </p>
            )}
          </form>

          {/* Toggle */}
          <p className="text-center text-slate-500 text-sm">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("signin"); setError(""); }}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => { setMode("signup"); setError(""); }}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Create one
                </button>
              </>
            )}
          </p>

          <p className="text-center">
            <a href="/" className="text-slate-400 text-sm hover:text-slate-600">
              â† Back to Home
            </a>
          </p>

        </div>
      </div>

    </div>
  );
}