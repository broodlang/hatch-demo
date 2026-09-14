// The client half of the channel demo. One socket, a topic chosen at runtime, and JSON both
// ways — no markup crosses this connection.
//
// It is plain page script rather than a hook, because the page is not a live view: there is no
// session, no model and nothing to morph. That is the distinction the demo exists to show.

(() => {
  const el = (id) => document.getElementById(id);
  const socket = BroodChannel.connect();
  let room = null;

  const status = (text, cls) => {
    const badge = el("status");
    badge.textContent = text;
    badge.className = `badge ${cls || ""}`;
  };

  const log = (text, cls) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = cls || "";
    a.textContent = text;
    li.appendChild(a);
    el("log").appendChild(li);
    el("log").scrollTop = el("log").scrollHeight;
  };

  el("connect").addEventListener("click", () => {
    const topic = el("topic").value;
    if (room) {
      room.leave();
      room = null;
    }
    room = socket.channel(topic, { name: el("name").value });

    // Every message the channel broadcasts. `joined`/`left` come from the channel's own
    // `join` and `terminate`, so a tab closing is announced without the page doing anything.
    room.on("said", (p) => log(`${p.name}: ${p.body}`));
    room.on("joined", (p) => log(`${p.name} joined`, "opacity-60"));
    room.on("left", (p) => log(`${p.name} left`, "opacity-60"));
    room.on("close", (p) => status(`closed: ${p.reason || "?"}`, "badge-warning"));

    room
      .join()
      .then((reply) => status(`joined ${reply.topic} as ${reply.name}`, "badge-success"))
      .catch((err) => status(`refused: ${err.reason || "?"}`, "badge-error"));
  });

  // A request/response over the same socket: the reply comes back on this frame's ref while
  // other pushes stream past it.
  el("who").addEventListener("click", () => {
    if (!room) return status("join first", "badge-warning");
    room.push("who", {}).then((reply) => log(`here: ${(reply.members || []).join(", ")}`, "opacity-60"));
  });

  el("say-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!room) return status("join first", "badge-warning");
    const body = el("body").value.trim();
    if (!body) return;
    room.push("say", { body });
    el("body").value = "";
  });
})();
