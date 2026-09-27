import { cn } from "@/lib/utils";

function highlight(json: string) {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (m) => {
      let cls = "text-amber-300";
      if (/^"/.test(m)) cls = /:$/.test(m) ? "text-sky-300" : "text-emerald-300";
      else if (/true|false/.test(m)) cls = "text-violet-300";
      else if (/null/.test(m)) cls = "text-zinc-400";
      return `<span class="${cls}">${m}</span>`;
    });
}

export function JsonView({ value, className }: { value: unknown; className?: string }) {
  const json = value === undefined ? "// no body" : JSON.stringify(value, null, 2);
  return (
    <pre
      className={cn("max-h-96 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-200", className)}
      dangerouslySetInnerHTML={{ __html: highlight(json) }}
    />
  );
}
