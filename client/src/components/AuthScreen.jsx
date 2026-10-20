import { useState } from "react";
import { api, saveToken } from "../api.js";

export default function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);
    const credentials = {
      email: data.get("email"),
      password: data.get("password"),
      ...(mode === "register" ? { name: data.get("name") } : {}),
    };
    try {
      const result = mode === "register" ? await api.register(credentials) : await api.login(credentials);
      saveToken(result.token);
      await onSignedIn(result.user);
    } catch (authError) {
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-window">
        <div className="auth-brand"><span className="gather-mark">g<span>.</span></span><span>gather</span></div>
        <div className="auth-content">
          <p className="auth-eyebrow">THE GOOD PLACE · TEAM WORKSPACE</p>
          <h1>{mode === "login" ? <>Good work<br />happens <em>together.</em></> : <>There’s room<br />for <em>one more.</em></>}</h1>
          <p className="auth-description">{mode === "login" ? "A quieter corner of the internet to think out loud, share the little wins, and make good things happen." : "Join the conversation. Bring your ideas, your questions, and the gif you’ve been saving."}</p>
          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && <label>Your name<input name="name" autoComplete="name" required minLength="2" maxLength="80" placeholder="Alex Morgan" /></label>}
            <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@yourteam.com" /></label>
            <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength="8" maxLength="72" placeholder="At least 8 characters" /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" disabled={loading}>{loading ? "Just a moment…" : mode === "login" ? "Step inside  →" : "Create my account  →"}</button>
          </form>
          <p className="auth-mode">
            {mode === "login" ? "First time here?" : "Already part of the team?"}
            {" "}<button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</button>
          </p>
        </div>
        <div className="auth-footer"><span>Made for the small moments that make great work.</span><span>✳</span></div>
      </div>
      <div className="auth-side-art" aria-hidden="true">
        <span className="art-orbit art-orbit-one" /><span className="art-orbit art-orbit-two" />
        <span className="art-spark art-spark-one">✳</span><span className="art-spark art-spark-two">✳</span>
        <div className="art-note art-note-one"><span className="art-note-dot" /> little thought, big things <span>↗</span></div>
        <div className="art-note art-note-two">make a little room<br />for good ideas <span>↙</span></div>
        <div className="art-card"><span className="art-card-kicker">A FRIENDLY REMINDER</span><span className="art-card-title">Better<br />together<span>.</span></span><span className="art-card-line" /><span className="art-card-foot">THE GOOD PLACE · EST. ALWAYS</span></div>
        <div className="art-sticker">this is<br />your sign <span>☺</span></div>
        <p className="art-quote">The best ideas rarely<br />happen in a vacuum.</p>
      </div>
    </main>
  );
}
