import React, { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function LoginPage() {
  const { login, register, error: authError } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await (mode === "login"
        ? login(email, password)
        : register(email, password));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-scene" aria-hidden="true">
        <div className="login-sun" />
        <div className="login-cloud login-cloud-one" />
        <div className="login-cloud login-cloud-two" />
        <div className="login-hills login-hills-back" />
        <div className="login-hills login-hills-front" />
        <div className="login-wildflowers" />
        <div className="login-scene-copy">
          <span className="login-scene-mark">*</span>
          <p>Ideas grow better together.</p>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="mb-8">
            <p className="login-eyebrow">Product Planr</p>
            <h1
              id="login-title"
              className="mt-3 text-3xl font-semibold text-slate-900"
            >
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {mode === "login"
                ? "Sign in to continue working on your graphs."
                : "Save and access your product architecture anywhere."}
            </p>
          </div>
          <form className="space-y-5" onSubmit={submit}>
            <label className="login-label">
              Email
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="login-input"
              />
            </label>
            <label className="login-label">
              Password
              <input
                required
                minLength={8}
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="login-input"
              />
            </label>
            {(error || authError) && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {error || authError.message}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="login-submit"
            >
              {submitting
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setMode((current) =>
                current === "login" ? "register" : "login",
              );
              setError(null);
            }}
            className="login-switch"
          >
            {mode === "login"
              ? "Need an account? Register"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}
