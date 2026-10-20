import { useState } from "react";

export default function AiPanel({ channel, summary, summaryLoading, onSummarize, onDraft, onClose, error }) {
  const [prompt, setPrompt] = useState("");

  async function handleDraft(event) {
    event.preventDefault();
    const suggestion = await onDraft(prompt);
    if (suggestion) setPrompt("");
  }

  return (
    <aside className="ai-panel">
      <div className="ai-panel-heading">
        <div><p className="ai-eyebrow"><span>✳</span> GATHER AI</p><h2>Your little helper</h2></div>
        <button className="icon-quiet" onClick={onClose} aria-label="Close AI helper">×</button>
      </div>
      <div className="ai-greeting"><span className="ai-greeting-mark">✳</span><div><strong>Hey, I’m here to help.</strong><p>Let’s get the conversation flowing.</p></div></div>
      <section className="ai-tool-card">
        <div className="ai-tool-title"><span className="ai-tool-icon">☷</span><div><strong>Catch me up</strong><span>A quick channel recap</span></div></div>
        <p className="ai-tool-description">Get the highlights, decisions, and any loose ends from <strong>#{channel?.name}</strong>.</p>
        <button className="ai-action-button" onClick={onSummarize} disabled={summaryLoading}>{summaryLoading ? <><span className="button-spinner" /> Pulling things together…</> : <>Summarize this channel <span>↗</span></>}</button>
        {summary && <div className="ai-result"><p className="ai-result-label">YOUR CHANNEL RECAP</p><p>{summary}</p></div>}
      </section>
      <section className="ai-tool-card">
        <div className="ai-tool-title"><span className="ai-tool-icon peach">✎</span><div><strong>Find the right words</strong><span>Draft something together</span></div></div>
        <p className="ai-tool-description">Tell me the gist and I’ll help you write a thoughtful reply.</p>
        <form className="ai-draft-form" onSubmit={handleDraft}>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} required minLength="3" maxLength="500" placeholder="e.g. Thank everyone and suggest we meet Friday…" />
          <button className="ai-action-button" disabled={summaryLoading || prompt.trim().length < 3}>Draft a reply <span>↗</span></button>
        </form>
      </section>
      {error && <p className="ai-error" role="alert">{error}</p>}
      <div className="ai-privacy"><span>✧</span><p>AI works with this channel’s recent messages. Your conversations stay yours.</p></div>
      <p className="ai-disclaimer">AI can get things wrong. Give it a quick read before sharing.</p>
    </aside>
  );
}
