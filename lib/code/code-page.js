"use client";
import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SerializeAddon } from "@xterm/addon-serialize";
import { PageLayout } from "../chat/components/page-layout.js";
import "@xterm/xterm/css/xterm.css";
const STATUS = { connected: "#22c55e", connecting: "#eab308", disconnected: "#ef4444" };
const RECONNECT_INTERVAL = 3e3;
function CodePage({ session, claudeWorkspaceId }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const retryTimer = useRef(null);
  const statusRef = useRef(null);
  const setStatus = useCallback((color) => {
    if (statusRef.current) statusRef.current.style.backgroundColor = color;
  }, []);
  const sendResize = useCallback(() => {
    const fit = fitAddonRef.current;
    const ws = wsRef.current;
    const term = termRef.current;
    if (!fit || !term || !ws || ws.readyState !== WebSocket.OPEN) return;
    fit.fit();
    const payload = JSON.stringify({ columns: term.cols, rows: term.rows });
    ws.send("1" + payload);
  }, []);
  const connect = useCallback(() => {
    const term = termRef.current;
    if (!term) return;
    setStatus(STATUS.connecting);
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/code/${claudeWorkspaceId}/ws`);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      const handshake = JSON.stringify({ AuthToken: "", columns: term.cols, rows: term.rows });
      ws.send(handshake);
      setStatus(STATUS.connected);
    };
    ws.onmessage = (ev) => {
      const data = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data);
      const type = data[0];
      const payload = data.slice(1);
      switch (type) {
        case "0":
          term.write(payload);
          break;
        case "1":
          document.title = payload || "Claude Code";
          break;
        case "2":
          break;
      }
    };
    ws.onclose = () => {
      setStatus(STATUS.disconnected);
      retryTimer.current = setTimeout(connect, RECONNECT_INTERVAL);
    };
    ws.onerror = () => {
      ws.close();
    };
  }, [claudeWorkspaceId, setStatus]);
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 16,
      fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", Menlo, monospace',
      theme: {
        background: "#1a1b26",
        foreground: "#a9b1d6",
        cursor: "#c0caf5",
        selectionBackground: "#33467c"
      },
      allowProposedApi: true
    });
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const serializeAddon = new SerializeAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(serializeAddon);
    termRef.current = term;
    fitAddonRef.current = fitAddon;
    term.open(containerRef.current);
    fitAddon.fit();
    term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send("0" + data);
      }
    });
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(sendResize, 100);
    };
    window.addEventListener("resize", handleResize);
    connect();
    return () => {
      clearTimeout(resizeTimeout);
      clearTimeout(retryTimer.current);
      window.removeEventListener("resize", handleResize);
      if (wsRef.current) wsRef.current.close();
      term.dispose();
    };
  }, [connect, sendResize]);
  const handleReconnect = () => {
    clearTimeout(retryTimer.current);
    if (wsRef.current) wsRef.current.close();
    connect();
  };
  const handleClear = () => {
    if (termRef.current) termRef.current.clear();
  };
  return /* @__PURE__ */ jsx(PageLayout, { session, contentClassName: "flex flex-col h-svh w-full p-4 overflow-hidden", children: /* @__PURE__ */ jsxs("div", { style: { flex: 1, minHeight: 0, background: "#1a1b26", position: "relative", borderRadius: 6, overflow: "hidden" }, children: [
    /* @__PURE__ */ jsx("div", { ref: containerRef, style: { width: "100%", height: "100%" } }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        style: {
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(30, 31, 46, 0.9)",
          backdropFilter: "blur(8px)",
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          zIndex: 1e3
        },
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              ref: statusRef,
              style: {
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: STATUS.connecting
              }
            }
          ),
          /* @__PURE__ */ jsx("button", { onClick: handleReconnect, style: btnStyle, children: "Reconnect" }),
          /* @__PURE__ */ jsx("button", { onClick: handleClear, style: btnStyle, children: "Clear" })
        ]
      }
    )
  ] }) });
}
const btnStyle = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "#a9b1d6",
  padding: "4px 10px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit"
};
export {
  CodePage as default
};
