// A hook, and the smallest honest example of why hooks exist: drawing an <svg> is not
// something a server-rendered diff should be doing, and the element's contents belong to
// whatever is drawing them.
//
// Registered before the page mounts — this file is loaded with `defer` from the layout, and
// BroodLive auto-mounts on DOMContentLoaded, so `hook` runs first.
BroodLive.hook("Sparkline", {
  mounted() {
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("viewBox", "0 0 160 48");
    this.svg.setAttribute("class", "w-full h-16");
    this.path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    this.path.setAttribute("fill", "none");
    this.path.setAttribute("stroke", "currentColor");
    this.path.setAttribute("stroke-width", "2");
    this.svg.appendChild(this.path);
    this.el.appendChild(this.svg);
    this.draw();
  },

  // Fires when the SERVER changed something on this element — here, `data-points`. It does
  // not fire for the DOM this hook maintains itself, because the element carries
  // `data-update="ignore"` and the framework leaves those children alone.
  updated() {
    this.draw();
  },

  destroyed() {
    if (this.svg) this.svg.remove();
  },

  // A dropped socket is worth showing rather than hiding: the chart is now stale and the
  // page should say so.
  disconnected() {
    this.el.classList.add("opacity-40");
  },

  reconnected() {
    this.el.classList.remove("opacity-40");
  },

  draw() {
    let points;
    try {
      points = JSON.parse(this.el.dataset.points || "[]");
    } catch (_) {
      return;
    }
    if (!Array.isArray(points) || points.length === 0) return;
    const step = 160 / Math.max(1, points.length - 1);
    this.path.setAttribute(
      "points",
      points.map((y, i) => `${(i * step).toFixed(1)},${(48 - y).toFixed(1)}`).join(" "),
    );
  },
});
