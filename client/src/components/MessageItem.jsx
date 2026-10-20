import { useState } from "react";

const reactions = ["👍", "❤️", "😂", "🎉", "👀", "🙌", "✨", "✅"];

function initials(name = "?") {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function timeLabel(value) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function MessageItem({ message, currentUser, onReact, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(message.content);
  const [showReactions, setShowReactions] = useState(false);
  const ownMessage = String(message.author?._id) === String(currentUser.id);

  async function saveEdit(event) {
    event.preventDefault();
    const result = await onEdit(message._id, content);
    if (result) setEditing(false);
  }

  return (
    <article className="message-row" id={`message-${message._id}`}>
      <div className={`message-avatar avatar-tone-${(message.author?.name?.charCodeAt(0) ?? 0) % 6}`}>{initials(message.author?.name)}</div>
      <div className="message-body">
        <div className="message-heading">
          <strong>{message.author?.name ?? "A teammate"}</strong>
          {message.author?.title && <span className="message-title">{message.author.title}</span>}
          <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}{message.editedAt && <span className="edited-tag"> · edited</span>}</time>
        </div>
        {editing ? (
          <form className="message-edit-form" onSubmit={saveEdit}>
            <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength="4000" autoFocus />
            <div><button type="button" className="small-quiet-button" onClick={() => { setContent(message.content); setEditing(false); }}>Cancel</button><button className="small-primary-button">Save</button></div>
          </form>
        ) : <p className="message-content">{message.content}</p>}
        {message.reactions?.length > 0 && (
          <div className="reaction-list">
            {message.reactions.map((reaction) => {
              const selected = reaction.users?.some((id) => String(id) === String(currentUser.id));
              return <button className={`reaction-chip${selected ? " reaction-selected" : ""}`} key={reaction.emoji} onClick={() => onReact(message._id, reaction.emoji)} title={`${reaction.users?.length ?? 0} reaction(s)`}>{reaction.emoji} <span>{reaction.users?.length ?? 0}</span></button>;
            })}
          </div>
        )}
      </div>
      <div className="message-tools">
        <button className="message-tool" onClick={() => setShowReactions((value) => !value)} title="Add a reaction" aria-label="Add a reaction">☺</button>
        {ownMessage && !editing && (
          <>
            <button className="message-tool" onClick={() => setEditing(true)} title="Edit message" aria-label="Edit message">✎</button>
            <button className="message-tool" onClick={() => onDelete(message._id)} title="Delete message" aria-label="Delete message">×</button>
          </>
        )}
      </div>
      {showReactions && <div className="reaction-picker">{reactions.map((emoji) => <button key={emoji} onClick={() => { onReact(message._id, emoji); setShowReactions(false); }} aria-label={`React ${emoji}`}>{emoji}</button>)}</div>}
    </article>
  );
}
