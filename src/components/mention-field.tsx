"use client";

import { useRef, useState } from "react";
import { border, ink } from "@/lib/design-tokens";
import type { MentionablePerson } from "@/lib/mentions";

// Finds the "@word" the caret is currently sitting inside of, if any —
// must be at the start of the text or preceded by whitespace, same rule
// Slack/Discord-style mention pickers use so an email address or a mid-word
// "@" doesn't trigger it.
function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const m = /(?:^|\s)@([A-Za-z][A-Za-z' -]*)?$/.exec(before);
  if (!m) return null;
  const query = m[1] ?? "";
  return { start: caret - query.length - 1, query };
}

type CommonProps = {
  value: string;
  onChange: (value: string) => void;
  people: MentionablePerson[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function MentionTextarea({
  value,
  onChange,
  people,
  placeholder,
  className,
  style,
  rows,
}: CommonProps & { rows?: number }) {
  return (
    <MentionFieldBase
      tag="textarea"
      value={value}
      onChange={onChange}
      people={people}
      placeholder={placeholder}
      className={className}
      style={style}
      rows={rows}
    />
  );
}

export function MentionInput({
  value,
  onChange,
  people,
  placeholder,
  className,
  style,
  onEnter,
}: CommonProps & { onEnter?: () => void }) {
  return (
    <MentionFieldBase
      tag="input"
      value={value}
      onChange={onChange}
      people={people}
      placeholder={placeholder}
      className={className}
      style={style}
      onEnter={onEnter}
    />
  );
}

function MentionFieldBase({
  tag,
  value,
  onChange,
  people,
  placeholder,
  className,
  style,
  rows,
  onEnter,
}: CommonProps & { tag: "textarea" | "input"; rows?: number; onEnter?: () => void }) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  const matches = query
    ? people.filter((p) => p.name.toLowerCase().includes(query.text.toLowerCase())).slice(0, 6)
    : [];

  const refreshQuery = (text: string, caret: number) => {
    const found = activeMentionQuery(text, caret);
    setQuery(found ? { start: found.start, text: found.query } : null);
    setHighlighted(0);
  };

  const pick = (person: MentionablePerson) => {
    if (!query) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, query.start);
    const after = value.slice(caret);
    const inserted = `@${person.name} `;
    onChange(`${before}${inserted}${after}`);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    onChange(e.target.value);
    refreshQuery(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (query && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[highlighted]);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && onEnter) onEnter();
  };

  const handleClick = (e: React.SyntheticEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const target = e.currentTarget;
    refreshQuery(target.value, target.selectionStart ?? 0);
  };

  const sharedProps = {
    ref: ref as React.Ref<never>,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onClick: handleClick,
    placeholder,
    className,
    style,
  };

  return (
    <div className="relative flex-1">
      {tag === "textarea" ? <textarea {...sharedProps} rows={rows} /> : <input {...sharedProps} />}
      {query && matches.length > 0 && (
        <div
          className="absolute z-20 rounded-xl overflow-hidden py-1"
          style={{ background: "#FFFFFF", border: `1px solid ${border}`, boxShadow: "0 2px 10px rgba(0,0,0,0.15)", minWidth: 180, top: "100%", left: 0, marginTop: 4 }}
        >
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className="block w-full text-left px-3 py-1.5 text-sm"
              style={{ background: i === highlighted ? "#F1F3F4" : "#FFFFFF", color: ink }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
