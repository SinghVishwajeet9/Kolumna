"use client";

import { Select } from "@/components/ui/Select";
import type { Member } from "./types";
import { Avatar } from "./Avatar";

export function AssigneeSelect({
  members,
  value,
  onChange,
  compact,
}: {
  members: Member[];
  value: string | null;
  onChange: (actorId: string | null) => void;
  compact?: boolean;
}) {
  return (
    <Select
      compact={compact}
      value={value}
      onChange={onChange}
      options={[
        { value: null, label: "Unassigned", icon: <Avatar actor={null} /> },
        ...members.map((m) => {
          const inactive = m.type === "AGENT" && m.agentStatus !== "ACTIVE";
          return {
            value: m.actorId,
            label: m.name,
            icon: <Avatar actor={{ id: m.actorId, displayName: m.name, type: m.type }} />,
            note: m.type === "AGENT" ? (inactive ? m.agentStatus?.toLowerCase() : "AI agent") : undefined,
            // An agent that's suspended or revoked can't be handed work.
            disabled: inactive,
          };
        }),
      ]}
    />
  );
}
