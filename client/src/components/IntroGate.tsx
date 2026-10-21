import { useEffect, useState } from "react";

const SEEN_KEY = "moltprotocol-intro-seen";

export function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

const NODES = [
  { cx: 70, cy: 120, delay: "0s" },
  { cx: 180, cy: 70, delay: "0.15s" },
  { cx: 290, cy: 120, delay: "0.3s" },
  { cx: 400, cy: 68, delay: "0.45s" },
  { cx: 510, cy: 116, delay: "0.6s" },
];

export function IntroGate({ children }: { children: React.ReactNode }) {
  const skipMotion = reducedMotion() || sessionStorage.getItem(SEEN_KEY) === "1";
  const [visible, setVisible] = useState(!skipMotion);
  const [leaving, setLeaving] = useState(false);

  function dismiss() {
    sessionStorage.setItem(SEEN_KEY, "1");
    setVisible(false);
    setLeaving(false);
  }

  useEffect(() => {
    if (!visible) return;
    const leaveTimer = window.setTimeout(() => setLeaving(true), 2000);
    const doneTimer = window.setTimeout(dismiss, 2400);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(doneTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible]);

  if (!visible) return children;

  return (
    <>
      {leaving && children}
      <div className={`intro${leaving ? " leaving" : ""}`} role="dialog" aria-label="MoltProtocol opening" onClick={dismiss}>
        <button type="button" className="skip" onClick={dismiss}>Skip</button>
        <div className="intro-stage">
          <svg viewBox="0 0 580 190" aria-hidden="true">
            {NODES.slice(0, -1).map((node, index) => {
              const next = NODES[index + 1];
              return <line key={node.cx} className="link-draw" x1={node.cx} y1={node.cy} x2={next.cx} y2={next.cy} stroke="#c9a24a" strokeWidth="1.4" style={{ animationDelay: `${0.45 + index * 0.12}s` }} />;
            })}
            {NODES.map((node) => (
              <circle key={node.cx} className="node-pop" cx={node.cx} cy={node.cy} r="7" fill={node.cx === 70 || node.cx === 510 ? "#c9a24a" : "#f4eee3"} style={{ animationDelay: node.delay }} />
            ))}
          </svg>
          <div className="intro-line" aria-hidden="true"><span /></div>
          <p className="intro-copy">Understand. Recover intent. Modernize with confidence.</p>
        </div>
      </div>
    </>
  );
}
