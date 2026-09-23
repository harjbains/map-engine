import { useState } from "react";
import type { V3SupabaseClient } from "./client.js";
import "./auth-panel.css";

export function UberAuthPanel({ client, error }: { client: V3SupabaseClient | null; error?: string | null }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const attempt = async (action: "password" | "signup" | "email" | "token") => {
    if (!client) return;
    setBusy(true); setNotice(null);
    try {
      const result = action === "password"
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : action === "signup"
          ? await client.auth.signUp({ email: email.trim(), password })
          : action === "email"
            ? await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.href, shouldCreateUser: true } })
            : await client.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: "email" });
      if (result.error) throw result.error;
      if (action === "email") setNotice("Check your email for a sign-in link or code. If the link opens elsewhere, use its code here.");
      if (action === "signup") setNotice("Account created! Check your email to confirm, or you may be logged in automatically.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Sign-in failed");
    } finally { setBusy(false); }
  };

  return <>
    <button className="uber-auth-entry" type="button" onClick={() => setOpen(true)}>UBER <span>{client ? "SIGN IN TO LOAD EARNINGS" : "SUPABASE CONFIGURATION NEEDED"}</span> <b>OPEN ›</b></button>
    {open && <div className="uber-modal-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="uber-auth-panel" role="dialog" aria-modal="true" aria-label="Uber sign in" onMouseDown={(event) => event.stopPropagation()}>
        <header><span>◆ MAP-ENGINE V3 · UBER</span><button type="button" aria-label="Close sign in" onClick={() => setOpen(false)}>×</button></header>
        <h1>Sign in to Uber</h1>
        <p>Your earnings and plan are available only to your authenticated Supabase account.</p>
        {!client ? <p role="alert">Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for this V3 project.</p> : <>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
            <button className="primary" style={{ flex: 1 }} type="button" disabled={busy || !email || !password} onClick={() => void attempt("password")}>SIGN IN</button>
            <button style={{ flex: 1 }} type="button" disabled={busy || !email || !password} onClick={() => void attempt("signup")}>CREATE ACCOUNT</button>
          </div>
          <button type="button" disabled={busy || !email} onClick={() => void attempt("email")}>EMAIL ME A SIGN-IN LINK OR CODE</button>
          <div className="uber-auth-code"><label>Email code<input type="text" inputMode="numeric" autoComplete="one-time-code" value={token} onChange={(event) => setToken(event.target.value)} /></label><button type="button" disabled={busy || !email || !token} onClick={() => void attempt("token")}>VERIFY CODE</button></div>
        </>}
        {(notice || error) && <p role="status" className="uber-auth-notice">{notice || error}</p>}
      </section>
    </div>}
  </>;
}
