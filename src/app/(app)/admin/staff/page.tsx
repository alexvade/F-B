"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/profile-context";
import { Section } from "@/components/section";
import { bg, border, ink, inkSoft, navy, orangeSoft } from "@/lib/design-tokens";
import type { Role } from "@/lib/supabase/types";

type StaffRow = { id: string; name: string; email: string | null; role: Role; contract_hours: number | null };

export default function StaffAdminPage() {
  const profile = useProfile();
  const supabase = createClient();

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contractHours, setContractHours] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("name");
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
      setMessage(`Invited ${name.trim()} — they'll get an email to set their password.`);
      setName("");
      setEmail("");
      setContractHours("");
      setRole("staff");
      loadStaff();
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (id: string, newRole: Role) => {
    await supabase.from("profiles").update({ role: newRole }).eq("id", id);
    loadStaff();
  };

  const inputStyle = { border: `1px solid ${border}`, background: bg, color: ink } as const;

  if (profile.role !== "admin") {
    return (
      <Section title="Manage staff">
        <p className="text-sm" style={{ color: inkSoft }}>
          Admins only.
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
        {staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl" style={{ border: `1px solid ${border}` }}>
            <div>
              <div className="text-sm font-medium">{s.name}</div>
              <div className="text-xs" style={{ color: inkSoft }}>
                {s.email} {s.contract_hours ? `· ${s.contract_hours}h contract` : ""}
              </div>
            </div>
            <select
              value={s.role}
              onChange={(e) => changeRole(s.id, e.target.value as Role)}
              className="text-xs px-2 py-1 rounded-full outline-none"
              style={inputStyle}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ))}
      </div>
    </Section>
  );
}
