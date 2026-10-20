import { useEffect, useState } from "react";
import { api } from "../api.js";

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function AdminPanel({ currentUser, onClose }) {
  const [members, setMembers] = useState([]);
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.adminMembers()
      .then((result) => { setMembers(result.members); setOwnerId(String(result.ownerId ?? "")); })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  async function changeRole(member) {
    const nextRole = member.role === "admin" ? "member" : "admin";
    setError("");
    try {
      const result = await api.updateMemberRole(member._id, nextRole);
      setMembers((current) => current.map((entry) => entry._id === member._id ? { ...entry, role: result.member.role } : entry));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="members-heading">
        <div className="dialog-heading"><div><p>THE PEOPLE WHO MAKE IT WORK</p><h2 id="members-heading">Workspace members</h2></div><button onClick={onClose} aria-label="Close">×</button></div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {loading ? <p className="admin-empty">Gathering the member list…</p> : members.length === 0 ? <p className="admin-empty">No members just yet.</p> : (
          <div className="admin-member-list">
            {members.map((member) => {
              const isOwner = String(member._id) === ownerId;
              const isSelf = String(member._id) === String(currentUser.id);
              return (
                <div className="admin-member-row" key={member._id}>
                  <span className={`person-avatar person-tone-${(member.name.charCodeAt(0) ?? 0) % 5}`}>{initials(member.name)}</span>
                  <div className="admin-member-info"><strong>{member.name}{isSelf ? " · you" : ""}</strong><span>{member.email}</span></div>
                  <span className={`admin-role-pill${member.role === "admin" ? " admin-role-owner" : ""}`}>{isOwner ? "owner" : member.role}</span>
                  {!isOwner && !isSelf && <button className="admin-role-toggle" onClick={() => changeRole(member)}>{member.role === "admin" ? "Make member" : "Make admin"}</button>}
                </div>
              );
            })}
          </div>
        )}
        <p className="admin-note">Only workspace admins can change roles. The workspace owner and the last administrator are always protected.</p>
      </section>
    </div>
  );
}
