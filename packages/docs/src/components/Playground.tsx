import { useState, useRef, useCallback } from "react";

interface PlaygroundProps {
  code: string;
}

export default function Playground({ code: initialCode }: PlaygroundProps) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(async () => {
    const logs: string[] = [];
    const fakeConsole = {
      log: (...args: unknown[]) => {
        logs.push(
          args
            .map((a) =>
              typeof a === "string" ? a : JSON.stringify(a, null, 2)
            )
            .join(" ")
        );
      },
    };

    try {
      // Dynamic import of the bundled core — Astro/Vite will resolve this
      const core = await import("@mvfm/core");
      const fn = new Function(
        "console",
        ...Object.keys(core),
        code
      );
      fn(fakeConsole, ...Object.values(core));
      setOutput(logs.join("\n"));
    } catch (e: unknown) {
      setOutput(String(e));
    }
  }, [code]);

  return (
    <div style={{ marginTop: "40px" }}>
      <textarea
        ref={textareaRef}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: "180px",
          fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace",
          fontSize: "13px",
          lineHeight: "1.6",
          padding: "16px",
          border: "1px solid #e0e0e0",
          borderRadius: "0",
          background: "#fafafa",
          color: "#333",
          resize: "vertical",
          outline: "none",
          tabSize: 2,
        }}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            setCode(code.substring(0, start) + "  " + code.substring(end));
            requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = start + 2;
            });
          }
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            run();
          }
        }}
      />
      <button
        onClick={run}
        type="button"
        style={{
          marginTop: "8px",
          padding: "6px 16px",
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: "12px",
          letterSpacing: "0.05em",
          background: "#000",
          color: "#fff",
          border: "none",
          cursor: "pointer",
        }}
      >
        RUN
      </button>
      <span
        style={{
          marginLeft: "12px",
          fontSize: "11px",
          color: "#999",
        }}
      >
        ⌘+Enter
      </span>
      {output && (
        <pre
          style={{
            marginTop: "16px",
            padding: "16px",
            background: "#fafafa",
            border: "1px solid #e0e0e0",
            fontFamily:
              "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace",
            fontSize: "12px",
            lineHeight: "1.5",
            color: "#333",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflow: "auto",
          }}
        >
          {output}
        </pre>
      )}
    </div>
  );
}
