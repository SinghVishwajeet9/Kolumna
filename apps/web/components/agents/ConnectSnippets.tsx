"use client";

import { useState } from "react";

const MCP_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100"}/mcp`;
const mono = { fontFamily: "var(--font-mono)" };

export const CLIENTS = [
  { id: "claude-code", label: "Claude Code" },
  { id: "antigravity", label: "Antigravity" },
  { id: "cursor", label: "Cursor" },
  { id: "other", label: "Other / curl" },
] as const;
export type ClientId = (typeof CLIENTS)[number]["id"];

// Each MCP client spells the same thing differently — Antigravity wants
// `serverUrl`, Cursor `url`, Claude Code a CLI command. Generating the exact
// snippet (with the real secret already in it) is what stops "PASTE_SECRET"
// placeholders ending up in someone's config.
function snippetFor(client: ClientId, clientId: string, secret: string) {
  const headers = { "X-Agent-Client-Id": clientId, "X-Agent-Client-Secret": secret };
  switch (client) {
    case "claude-code":
      return {
        where: "Run in any terminal:",
        code: `claude mcp add --scope user --transport http kolumna ${MCP_URL} --header "X-Agent-Client-Id: ${clientId}" --header "X-Agent-Client-Secret: ${secret}"`,
      };
    case "antigravity":
      return {
        where: "Settings → Customizations → Open MCP Config, then add under mcpServers:",
        code: JSON.stringify({ mcpServers: { kolumna: { serverUrl: MCP_URL, headers } } }, null, 2),
      };
    case "cursor":
      return {
        where: "Add to ~/.cursor/mcp.json:",
        code: JSON.stringify({ mcpServers: { kolumna: { url: MCP_URL, headers } } }, null, 2),
      };
    default:
      return {
        where: "Any MCP client that supports HTTP + headers. Quick check with curl:",
        code: `curl -X POST ${MCP_URL} -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -H "X-Agent-Client-Id: ${clientId}" -H "X-Agent-Client-Secret: ${secret}" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
      };
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 text-[12px] text-accent hover:underline"
      style={mono}
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}

export function ConnectSnippets({
  clientId,
  secret,
  initialClient = "claude-code",
}: {
  clientId: string;
  secret: string;
  initialClient?: ClientId;
}) {
  const [client, setClient] = useState<ClientId>(initialClient);
  const s = snippetFor(client, clientId, secret);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {CLIENTS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setClient(c.id)}
            className={`border px-3 py-1.5 text-[12px] transition-colors ${
              client === c.id ? "border-accent text-accent" : "border-line text-faint hover:text-fg"
            }`}
            style={{ borderRadius: 999, ...mono }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[13px] text-muted">{s.where}</p>
      <div className="relative border border-line bg-bg p-4" style={{ borderRadius: 10 }}>
        <div className="absolute top-3 right-3">
          <CopyButton text={s.code} />
        </div>
        <pre className="overflow-x-auto pr-14 text-[12px] leading-relaxed whitespace-pre-wrap break-all text-fg" style={mono}>
          {s.code}
        </pre>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 text-[12px]" style={mono}>
        <dt className="text-faint">client id</dt>
        <dd className="truncate text-fg">{clientId}</dd>
        <CopyButton text={clientId} />
        <dt className="text-faint">secret</dt>
        <dd className="truncate text-fg">{secret}</dd>
        <CopyButton text={secret} />
      </dl>
    </div>
  );
}
