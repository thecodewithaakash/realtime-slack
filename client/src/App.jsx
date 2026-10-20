import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, clearToken, getToken } from "./api.js";
import AdminPanel from "./components/AdminPanel.jsx";
import AiPanel from "./components/AiPanel.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import MessageItem from "./components/MessageItem.jsx";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4001";
const shortDate = new Intl.DateTimeFormat([], { month: "long", day: "numeric", year: "numeric" });

function initials(name = "") {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function App() {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [members, setMembers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [composer, setComposer] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [socketError, setSocketError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [channelError, setChannelError] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [booting, setBooting] = useState(Boolean(getToken()));
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesListRef = useRef(null);
  const typingTimerRef = useRef(null);
  const activeChannelRef = useRef(activeChannel);

  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);

  const initializeWorkspace = useCallback(async () => {
    const [identity, channelResult] = await Promise.all([api.me(), api.channels()]);
    setUser(identity.user);
    setWorkspace(identity.workspace);
    setMembers(identity.members);
    setChannels(channelResult.channels);
    setActiveChannel((current) => channelResult.channels.find((channel) => channel._id === current?._id) ?? channelResult.channels[0] ?? null);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }
    let active = true;
    Promise.all([api.me(), api.channels()])
      .then(([identity, channelResult]) => {
        if (!active) return;
        setUser(identity.user);
        setWorkspace(identity.workspace);
        setMembers(identity.members);
        setChannels(channelResult.channels);
        setActiveChannel(channelResult.channels[0] ?? null);
      })
      .catch(() => {
        clearToken();
        if (active) setUser(null);
      })
      .finally(() => { if (active) setBooting(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const socket = io(SOCKET_URL, { auth: { token: getToken() } });
    socketRef.current = socket;
    socket.on("connect", () => {
      setSocketStatus("connected");
      setSocketError("");
      const channel = activeChannelRef.current;
      if (channel) socket.emit("channel:join", channel._id, (result) => {
        if (result?.error) setSocketError(result.error);
      });
    });
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.on("connect_error", (error) => {
      setSocketStatus("disconnected");
      setSocketError(error.message);
    });
    socket.on("presence:list", setOnlineUsers);
    socket.on("presence:update", ({ userId, status }) => {
      setOnlineUsers((current) => status === "online"
        ? current.includes(userId) ? current : [...current, userId]
        : current.filter((id) => id !== userId));
    });
    socket.on("message:new", (message) => {
      if (String(message.channel) !== String(activeChannelRef.current?._id)) return;
      setMessages((current) => current.some((item) => item._id === message._id) ? current : [...current, message]);
    });
    socket.on("message:update", (message) => {
      if (String(message.channel) !== String(activeChannelRef.current?._id)) return;
      setMessages((current) => current.map((item) => item._id === message._id ? message : item));
    });
    socket.on("message:delete", ({ id }) => setMessages((current) => current.filter((item) => item._id !== id)));
    socket.on("typing:update", ({ channelId, userId, name, typing }) => {
      if (String(channelId) !== String(activeChannelRef.current?._id) || userId === String(user.id)) return;
      setTypingUsers((current) => typing
        ? current.some((entry) => entry.userId === userId) ? current : [...current, { userId, name }]
        : current.filter((entry) => entry.userId !== userId));
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
      window.clearTimeout(typingTimerRef.current);
    };
  }, [user]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeChannel) return;
    setTypingUsers([]);
    setSummary("");
    setAiError("");
    setMessages([]);
    setHasMore(false);
    setLoadingMessages(true);
    setMessageError("");
    socket.emit("channel:join", activeChannel._id, (result) => {
      if (result?.error) setSocketError(result.error);
    });
    let active = true;
    api.messages(activeChannel._id)
      .then((result) => {
        if (!active) return;
        setMessages(result.messages);
        setHasMore(result.hasMore);
        requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" }));
      })
      .catch((error) => { if (active) setMessageError(error.message); })
      .finally(() => { if (active) setLoadingMessages(false); });
    return () => { active = false; };
  }, [activeChannel]);

  useEffect(() => {
    const query = searchInput.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError("");
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      api.search(query)
        .then((result) => { if (active) { setSearchResults(result.messages); setSearchError(""); } })
        .catch((error) => { if (active) setSearchError(error.message); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchInput]);

  const onlineSet = useMemo(() => new Set(onlineUsers.map(String)), [onlineUsers]);

  async function signIn() {
    await initializeWorkspace();
  }

  function signOut() {
    clearToken();
    socketRef.current?.disconnect();
    setUser(null);
    setWorkspace(null);
    setChannels([]);
    setMessages([]);
    setActiveChannel(null);
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = composer.trim();
    const socket = socketRef.current;
    if (!content || !activeChannel || !socket?.connected) {
      if (!socket?.connected) setMessageError("You’re offline. Your message will send when you reconnect.");
      return;
    }
    setMessageError("");
    socket.emit("message:send", { channelId: activeChannel._id, content }, (result) => {
      if (result?.error) setMessageError(result.error);
      else setComposer("");
    });
    socket.emit("typing:stop", activeChannel._id);
  }

  function updateComposer(value) {
    setComposer(value);
    const socket = socketRef.current;
    if (!socket?.connected || !activeChannel) return;
    socket.emit(value.trim() ? "typing:start" : "typing:stop", activeChannel._id);
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => socket.emit("typing:stop", activeChannel._id), 1800);
  }

  async function loadOlderMessages() {
    if (!activeChannel || olderLoading || messages.length === 0) return;
    const container = messagesListRef.current;
    const oldHeight = container?.scrollHeight ?? 0;
    setOlderLoading(true);
    try {
      const result = await api.messages(activeChannel._id, messages[0]._id);
      setMessages((current) => [...result.messages, ...current]);
      setHasMore(result.hasMore);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - oldHeight;
      });
    } catch (error) {
      setMessageError(error.message);
    } finally {
      setOlderLoading(false);
    }
  }

  async function editMessage(id, content) {
    try {
      await api.editMessage(id, content);
      return true;
    } catch (error) {
      setMessageError(error.message);
      return false;
    }
  }

  async function deleteMessage(id) {
    if (!window.confirm("Delete this message? This can’t be undone.")) return;
    try {
      await api.deleteMessage(id);
    } catch (error) {
      setMessageError(error.message);
    }
  }

  async function toggleReaction(messageId, emoji) {
    try {
      await api.toggleReaction(messageId, emoji);
    } catch (error) {
      setMessageError(error.message);
    }
  }

  async function createChannel(event) {
    event.preventDefault();
    setChannelError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.createChannel({ name: form.get("name"), description: form.get("description") });
      setChannels((current) => [...current, result.channel].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveChannel(result.channel);
      setShowAddChannel(false);
      setMobileSidebar(false);
    } catch (error) {
      setChannelError(error.message);
    }
  }

  async function summarize() {
    if (!activeChannel) return;
    setSummaryLoading(true);
    setAiError("");
    try {
      const result = await api.summarize(activeChannel._id);
      setSummary(result.summary);
    } catch (error) {
      setAiError(error.message);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function draftReply(prompt) {
    if (!activeChannel) return "";
    setSummaryLoading(true);
    setAiError("");
    try {
      const result = await api.suggest(activeChannel._id, prompt);
      setComposer(result.suggestion);
      return result.suggestion;
    } catch (error) {
      setAiError(error.message);
      return "";
    } finally {
      setSummaryLoading(false);
    }
  }

  function openSearchResult(message) {
    const channel = message.channel;
    const match = channels.find((item) => item._id === String(channel?._id));
    if (!match) return;
    setActiveChannel(match);
    setSearchInput("");
    setMobileSidebar(false);
  }

  if (booting) {
    return <main className="boot-screen"><span className="gather-mark">g<span>.</span></span><p>Finding your place…</p></main>;
  }
  if (!user) return <AuthScreen onSignedIn={signIn} />;

  return (
    <main className={`workspace-shell${mobileSidebar ? " sidebar-open" : ""}`}>
      <div className="workspace-sidebar">
        <header className="workspace-header">
          <div className="workspace-title-group">
            <span className="workspace-logo">{(workspace?.name ?? "G").slice(0, 1).toUpperCase()}</span>
            <div><strong>{workspace?.name ?? "Your workspace"}</strong><span>{user.role === "admin" ? "Workspace owner" : "Team workspace"}</span></div>
          </div>
          <button className="workspace-menu-button" onClick={signOut} aria-label="Sign out" title="Sign out">⌄</button>
        </header>
        <button className="workspace-search" onClick={() => document.getElementById("global-search")?.focus()}><span>⌕</span><span>Search everything</span><kbd>⌘ K</kbd></button>
        <div className="sidebar-scroll">
          <nav className="sidebar-nav" aria-label="Workspace navigation">
            <button className="sidebar-item"><span className="sidebar-nav-icon">✉</span> Drafts <span className="sidebar-item-count">0</span></button>
            <button className="sidebar-item"><span className="sidebar-nav-icon">◷</span> Later</button>
            <button className="sidebar-item"><span className="sidebar-nav-icon">◎</span> Activity</button>
          </nav>
          <section className="sidebar-section">
            <div className="sidebar-section-heading"><span>CHANNELS <small>{channels.length}</small></span><button onClick={() => { setChannelError(""); setShowAddChannel(true); }} title="Create a channel" aria-label="Create a channel">＋</button></div>
            <div className="channel-list">
              {channels.map((channel) => (
                <button key={channel._id} className={`channel-link${channel._id === activeChannel?._id ? " channel-active" : ""}`} onClick={() => { setActiveChannel(channel); setMobileSidebar(false); setSearchInput(""); }}>
                  <span className="channel-hash">#</span><span>{channel.name}</span>{channel._id === activeChannel?._id && <span className="channel-active-dot" />}
                </button>
              ))}
            </div>
          </section>
          <section className="sidebar-section people-section">
            <div className="sidebar-section-heading"><span>PEOPLE <small>{members.length}</small></span><div className="people-heading-tools"><span className="people-live-count">{onlineUsers.length} online</span>{user.role === "admin" && <button onClick={() => setShowAdminPanel(true)} title="Manage workspace members" aria-label="Manage workspace members">⚙</button>}</div></div>
            <div className="people-list">
              {members.map((member) => {
                const online = onlineSet.has(String(member._id));
                return <div className="person-link" key={member._id}><span className={`person-avatar person-tone-${(member.name.charCodeAt(0) ?? 0) % 5}`}>{initials(member.name)}<i className={online ? "presence-dot online" : "presence-dot"} /></span><span>{member.name.split(" ")[0]}{String(member._id) === String(user.id) ? " (you)" : ""}</span></div>;
              })}
            </div>
          </section>
        </div>
        <footer className="sidebar-profile">
          <div className="profile-avatar">{initials(user.name)}</div>
          <div><strong>{user.name}</strong><span>{user.title}</span></div>
          <span className={`profile-status ${socketStatus === "connected" ? "status-online" : ""}`} title={socketStatus === "connected" ? "Connected" : "Reconnecting"} />
          <button className="sidebar-signout" onClick={signOut} title="Sign out" aria-label="Sign out">↗</button>
        </footer>
      </div>

      <section className="conversation-panel">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileSidebar((value) => !value)} aria-label="Toggle menu">☰</button>
          <div className="topbar-search-wrap">
            <label className="topbar-search"><span>⌕</span><input id="global-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search messages" /><kbd>⌘ G</kbd></label>
            {searchInput.trim().length >= 2 && (
              <div className="search-results">
                <p>{searchError || (searchResults.length ? `${searchResults.length} matching messages` : "Looking through the conversation…")}</p>
                {searchResults.map((message) => (
                  <button key={message._id} className="search-result" onClick={() => openSearchResult(message)}>
                    <span className="search-result-channel">#{message.channel?.name} · {message.author?.name}</span>
                    <span>{message.content}</span>
                  </button>
                ))}
                {!searchError && searchResults.length === 0 && <span className="search-empty">No messages found yet.</span>}
              </div>
            )}
          </div>
          <button className="topbar-help" onClick={() => setAiOpen((value) => !value)} title="Open Gather AI">✳</button>
          <button className="topbar-help topbar-invite" onClick={() => setShowAddChannel(true)} title="Create a channel">＋</button>
        </header>

        <div className="channel-header">
          <div className="channel-heading">
            <span className="large-hash">#</span>
            <div><h1>{activeChannel?.name ?? "Choose a channel"}</h1><p>{activeChannel?.description || "A little space for the conversation."}</p></div>
          </div>
          <div className="channel-header-actions">
            <div className="channel-member-stack" aria-label={`${members.length} workspace members`}>
              {members.slice(0, 3).map((member) => <span className="stacked-avatar" key={member._id}>{initials(member.name)}</span>)}
              {members.length > 3 && <span className="stacked-more">+{members.length - 3}</span>}
            </div>
            <span className="channel-member-count">{members.length} members</span>
            <span className="header-divider" />
            <button className={`ai-header-button${aiOpen ? " ai-header-active" : ""}`} onClick={() => setAiOpen((value) => !value)}><span>✳</span> Gather AI</button>
            <button className="channel-more-button" aria-label="Channel options" title="More channel actions">···</button>
          </div>
        </div>

        <div className="conversation-body">
          <div className="messages-panel">
            <div className="messages-list" ref={messagesListRef}>
              {hasMore && <button className="load-older-button" onClick={loadOlderMessages} disabled={olderLoading}>{olderLoading ? "Gathering the earlier conversation…" : "↑  Load earlier messages"}</button>}
              {loadingMessages ? <div className="messages-loading"><span className="loading-spark">✳</span><p>Getting the conversation…</p></div> : messageError && messages.length === 0 ? <div className="messages-error" role="alert">{messageError}<button onClick={() => setActiveChannel({ ...activeChannel })}>Try again</button></div> : messages.length === 0 ? (
                <div className="channel-welcome">
                  <div className="welcome-channel-mark">#</div>
                  <p className="welcome-eyebrow">THE START OF SOMETHING GOOD</p>
                  <h2>Welcome to <span>#{activeChannel?.name}</span>.</h2>
                  <p>{activeChannel?.description || "A little space for the conversation."} This is the beginning of the channel. Say hello, share a thought, or ask the first question.</p>
                  <div className="welcome-nudge"><span>↘</span> Everyone starts somewhere.</div>
                </div>
              ) : (
                <>
                  <div className="message-day-divider"><span>{shortDate.format(new Date(messages[0].createdAt))}</span></div>
                  {messages.map((message, index) => {
                    const previous = messages[index - 1];
                    const separateDay = previous && new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                    return (
                      <div key={message._id}>
                        {separateDay && <div className="message-day-divider"><span>{shortDate.format(new Date(message.createdAt))}</span></div>}
                        <MessageItem message={message} currentUser={user} onReact={toggleReaction} onEdit={editMessage} onDelete={deleteMessage} />
                      </div>
                    );
                  })}
                </>
              )}
              {typingUsers.length > 0 && <div className="typing-indicator"><span className="typing-dots"><i /><i /><i /></span><span>{typingUsers.map((entry) => entry.name.split(" ")[0]).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing</span></div>}
              {socketError && <div className="inline-status" role="status"><span className="status-warning-dot" />{socketError}</div>}
              {socketStatus === "disconnected" && !socketError && <div className="inline-status"><span className="status-warning-dot" />Reconnecting to the conversation…</div>}
              <div ref={messagesEndRef} />
            </div>
            <form className="composer-wrap" onSubmit={sendMessage}>
              {messageError && <p className="composer-error" role="alert">{messageError}<button type="button" onClick={() => setMessageError("")}>×</button></p>}
              <div className="composer-box">
                <textarea value={composer} onChange={(event) => updateComposer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} placeholder={`Message #${activeChannel?.name ?? "channel"}`} maxLength="4000" aria-label="Write a message" disabled={!activeChannel} />
                <div className="composer-toolbar">
                  <div className="composer-tools">
                    <button type="button" title="Bold" onClick={() => setComposer((value) => `${value}****`)}>B</button>
                    <button type="button" className="italic-tool" title="Italic" onClick={() => setComposer((value) => `${value}__`)}>I</button>
                    <span className="composer-tool-separator" />
                    <button type="button" title="Add an emoji" onClick={() => setComposer((value) => `${value} ✨`)}>☺</button>
                    <button type="button" title="Draft with Gather AI" onClick={() => setAiOpen(true)}>✳</button>
                    <span className="composer-char-count">{composer.length > 3000 ? `${composer.length}/4000` : ""}</span>
                  </div>
                  <button className="send-button" type="submit" disabled={!composer.trim() || socketStatus !== "connected"} aria-label="Send message" title="Send message"><span>Send</span><span className="send-arrow">↑</span></button>
                </div>
              </div>
              <p className="composer-hint"><kbd>↵</kbd> to send · <kbd>⇧ ↵</kbd> for a new line</p>
            </form>
          </div>
          {aiOpen && <AiPanel channel={activeChannel} summary={summary} summaryLoading={summaryLoading} onSummarize={summarize} onDraft={draftReply} onClose={() => setAiOpen(false)} error={aiError} />}
        </div>
      </section>

      {mobileSidebar && <button className="sidebar-scrim" onClick={() => setMobileSidebar(false)} aria-label="Close navigation" />}
      {showAddChannel && (
        <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowAddChannel(false)}>
          <section className="channel-dialog" role="dialog" aria-modal="true" aria-labelledby="channel-dialog-title">
            <div className="dialog-heading"><div><p>MAKE A LITTLE SPACE</p><h2 id="channel-dialog-title">Create a channel</h2></div><button onClick={() => setShowAddChannel(false)} aria-label="Close">×</button></div>
            <form onSubmit={createChannel}>
              <label>Channel name<div className="channel-name-input"><span>#</span><input name="name" required minLength="2" maxLength="60" pattern="[A-Za-z0-9_-]+" placeholder="good-ideas" autoFocus /></div></label>
              <label>What’s it for? <span className="dialog-optional">optional</span><textarea name="description" maxLength="200" rows="3" placeholder="Give everyone a little context…" /></label>
              {channelError && <p className="channel-form-error" role="alert">{channelError}</p>}
              <div className="dialog-actions"><button type="button" className="dialog-cancel" onClick={() => setShowAddChannel(false)}>Cancel</button><button className="dialog-submit">Create channel <span>↗</span></button></div>
            </form>
          </section>
        </div>
      )}
      {showAdminPanel && user.role === "admin" && <AdminPanel currentUser={user} onClose={() => setShowAdminPanel(false)} />}
    </main>
  );
}

export default App;
