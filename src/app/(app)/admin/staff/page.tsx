"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { usePresenceViewer } from "@/lib/presence";
import { Section } from "@/components/section";
import { border, fill, ink, inkSoft, navy, orangeSoft } from "@/lib/design-tokens";
import type { Role } from "@/lib/supabase/types";

type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  contract_hours: number | null;
  is_casual: boolean;
  is_supervisor: boolean;
  is_super_admin: boolean;
};

export default function StaffAdminPage() {
  const profile = useProfile();
  const supabase = createClient();
  const presence = usePresenceViewer();

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contractHours, setContractHours] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from("profiles_directory").select("*").order("name");
    setStaff(data ?? []);
  }, [supabase]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const invite = async () => {
    if (!name.trim() || !email.trim()) return;
    setInviting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/invite-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          contract_hours: contractHours ? Number(contractHours) : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage(body.error || "Something went wrong.");
        return;
      }
      const linked = body.rotaShiftsLinked as number | undefined;
      setMessage(
        `Invited ${name.trim()} — they'll get an email to set their password.` +
          (linked ? ` Linked to ${linked} existing rota shift${linked === 1 ? "" : "s"} under that name.` : "")
      );
      setName("");
      setEmail("");
      setContractHours("");
      setRole("staff");
      loadStaff();
    } finally {
      setInviting(false);
    }
  };

  // One status covers the role column plus two separate flags.
  // "Supervisor" is a label only (see 0052_supervisor_status.sql) — it
  // carries exactly the same permissions as "Team member" everywhere else
  // in the app, same as how "Casual" is just role=staff + is_casual=true.
  // "Super-admin" always implies role=admin too (see 0042's comment on that
  // tier sitting on top of, not instead of, admin).
  type Status = "super_admin" | "admin" | "supervisor" | "team_member" | "casual";
  const statusOf = (s: StaffRow): Status => {
    if (s.is_super_admin) return "super_admin";
    if (s.role === "admin") return "admin";
    if (s.is_casual) return "casual";
    if (s.is_supervisor) return "supervisor";
    return "team_member";
  };

  const changeStatus = async (member: StaffRow, status: Status) => {
    const patch = {
      role: (status === "admin" || status === "super_admin" ? "admin" : "staff") as Role,
      is_super_admin: status === "super_admin",
      is_casual: status === "casual",
      is_supervisor: status === "supervisor",
    };
    setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, ...patch } : s)));
    await supabase.from("profiles").update(patch).eq("id", member.id);
  };

  const deleteStaff = async (member: StaffRow) => {
    if (!confirm(`Delete ${member.name}'s account? This can't be undone — they'll lose access immediately.`)) return;
    setMessage(null);
    const res = await fetch("/api/admin/delete-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error || "Couldn't delete that account.");
      return;
    }
    loadStaff();
  };

  const inputStyle = { border: `1px solid ${border}`, background: fill, color: ink } as const;

  if (!profile.is_super_admin) {
    return (
      <Section title="Manage staff">
        <p className="text-sm" style={{ color: inkSoft }}>
          Super admins only.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Manage staff" subtitle="Invite new accounts and set who's an admin">
      <div className="p-4 rounded-2xl mb-6" style={{ background: orangeSoft }}>
        <div className="text-sm font-medium mb-3" style={{ color: navy }}>
          Invite a staff member
        </div>
        <div className="flex flex-col gap-2 max-w-md">
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={inputStyle}
          />
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-sm px-4 py-2 rounded-full outline-none"
            style={inputStyle}
          />
          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="text-sm px-3 py-2 rounded-full outline-none flex-1"
              style={inputStyle}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <input
              placeholder="Contract hrs"
              type="number"
              value={contractHours}
              onChange={(e) => setContractHours(e.target.value)}
              className="text-sm px-4 py-2 rounded-full outline-none w-32"
              style={inputStyle}
            />
          </div>
          <button
            onClick={invite}
            disabled={inviting}
            className="text-sm font-medium py-2.5 rounded-full disabled:opacity-60"
            style={{ background: navy, color: "#FFFFFF" }}
          >
            {inviting ? "Sending invite…" : "Send invite"}
          </button>
          {message && (
            <div className="text-xs" style={{ color: navy }}>
              {message}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {staff.map((s) => {
          const status = presence.get(s.id);
          const statusLabel = status === "online" ? "Online" : status === "idle" ? "Idle" : "Offline";
          return (
          <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl" style={{ border: `1px solid ${border}` }}>
            <div>
              <div className="text-sm font-medium flex items-center gap-1.5">
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: status === "online" ? "#000000" : "transparent",
                    border: `1.5px solid ${border}`,
                    opacity: status ? 1 : 0.3,
                  }}
                />
                {s.name}
              </div>
              <div className="text-xs" style={{ color: inkSoft }}>
                {statusLabel} · {s.email} {s.contract_hours ? `· ${s.contract_hours}h contract` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={statusOf(s)}
                onChange={(e) => changeStatus(s, e.target.value as Status)}
                disabled={s.id === profile.id}
                title={
                  s.id === profile.id
                    ? "You can't change your own status here"
                    : "Casual staff see the Availability page to mark days they can't work"
                }
                className="text-xs px-2 py-1 rounded-full outline-none disabled:opacity-60"
                style={inputStyle}
              >
                <option value="casual">Casual</option>
                <option value="team_member">Team member</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super-admin</option>
              </select>
              {s.id !== profile.id && (
                <button onClick={() => deleteStaff(s)} aria-label={`Delete ${s.name}`} style={{ color: "#000000" }}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </Section>
  );
}
