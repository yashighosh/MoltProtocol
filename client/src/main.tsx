import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import plexSans400 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url";
import plexSans500 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2?url";
import plexSans600 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url";
import plexMono400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url";
import plexMono500 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url";
import { App } from "./App";
import { AuthProvider } from "./auth";
import { ToastProvider } from "./components/Toast";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/landing.css";
import "./styles/app.css";
import "./styles/workspaces.css";

const faces = [
  ["IBM Plex Sans", 400, plexSans400],
  ["IBM Plex Sans", 500, plexSans500],
  ["IBM Plex Sans", 600, plexSans600],
  ["IBM Plex Mono", 400, plexMono400],
  ["IBM Plex Mono", 500, plexMono500],
] as const;
const faceStyle = document.createElement("style");
faceStyle.textContent = faces.map(([family, weight, url]) => `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("${url}") format("woff2");}`).join("");
document.head.appendChild(faceStyle);
const preload = document.createElement("link");
preload.rel = "preload";
preload.as = "font";
preload.type = "font/woff2";
preload.crossOrigin = "anonymous";
preload.href = plexSans400;
document.head.appendChild(preload);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
);
