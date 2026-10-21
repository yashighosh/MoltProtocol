import { useEffect, useState } from "react";

const SEEN_KEY = "moltprotocol-intro-seen";

export function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function IntroGate({ children }: { children: React.ReactNode }) {
  const skipMotion = reducedMotion() || sessionStorage.getItem(SEEN_KEY) === "1";
  const [visible, setVisible] = useState(!skipMotion);

  function dismiss() {
    sessionStorage.setItem(SEEN_KEY, "1");
    setVisible(false);
  }

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(dismiss, 1800);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return children;

  return (
    <div className="intro" role="dialog" aria-label="MoltProtocol opening">
      <button type="button" onClick={dismiss}>Skip</button>
      <svg viewBox="0 0 640 220" aria-hidden="true">
        <path className="draw" d="M40 160 L140 70 L240 150 L340 60 L460 140 L590 50" fill="none" stroke="#b18b42" strokeWidth="2" />
        <path className="draw" d="M80 180 L200 100 L320 170 L500 80" fill="none" stroke="#f0e9dc" strokeWidth="1.4" />
        <text className="word" x="40" y="40">MoltProtocol</text>
      </svg>
    </div>
  );
}
