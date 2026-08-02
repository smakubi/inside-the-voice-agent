import type { ReactNode } from "react";

const pythonTokens = /(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b)|(\b[A-Za-z_]\w*(?=\s*\())|(\b\d+(?:_\d+)*(?:\.\d+)?\b)/gm;

export function PythonCode({ code }: { code: string }) {
  const output: ReactNode[] = [];
  let cursor = 0;

  for (const match of code.matchAll(pythonTokens)) {
    const index = match.index ?? 0;
    if (index > cursor) output.push(code.slice(cursor, index));
    const color = match[1]
      ? "text-slate-500 italic"
      : match[2]
        ? "text-amber-300"
        : match[3]
          ? "text-fuchsia-300"
          : match[4]
            ? "text-sky-300"
            : "text-emerald-300";
    output.push(<span key={`${index}-${match[0]}`} className={color}>{match[0]}</span>);
    cursor = index + match[0].length;
  }

  if (cursor < code.length) output.push(code.slice(cursor));
  return <>{output}</>;
}
