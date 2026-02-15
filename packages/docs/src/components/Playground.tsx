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
      const core = await import("@mvfm/core");
      const fn = new Function("console", ...Object.keys(core), code);
      fn(fakeConsole, ...Object.values(core));
      setOutput(logs.join("\n"));
    } catch (e: unknown) {
      setOutput(String(e));
    }
  }, [code]);

  return (
    <div className="mt-10">
      <textarea
        ref={textareaRef}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        className="w-full min-h-[180px] font-mono text-[13px] leading-relaxed p-4 bg-base-900 text-base-200 border border-base-800 rounded-none resize-y outline-none focus:border-base-600 transition-colors"
        style={{ tabSize: 2 }}
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
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={run}
          type="button"
          className="px-4 py-1.5 text-xs tracking-widest font-medium bg-base-50 text-base-950 hover:bg-base-200 transition-colors cursor-pointer"
        >
          RUN
        </button>
        <span className="text-[11px] text-base-600">
          Ctrl+Enter
        </span>
      </div>
      {output && (
        <pre className="mt-4 p-4 bg-base-900 border border-base-800 font-mono text-xs leading-relaxed text-base-300 whitespace-pre-wrap break-words overflow-auto">
          {output}
        </pre>
      )}
    </div>
  );
}
