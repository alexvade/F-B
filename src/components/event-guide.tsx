import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import type { EventContent } from "@/lib/event-content";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-fraunces" });
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-public-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-plex-mono" });

// Deliberately its own editorial look (serif headings, sage/gold palette)
// rather than the app's navy/orange system — this is a printed-guide feel
// for a single event, not a dashboard screen. Scoped under .eg- / .event-
// guide-wrap so nothing here leaks into the rest of the app, and vice versa.
const STYLES = `
.event-guide-wrap {
  --eg-bg: #F1F4EE;
  --eg-surface: #FBFBF6;
  --eg-ink: #1E241C;
  --eg-muted: #5C6455;
  --eg-accent: #3F5C3F;
  --eg-accent-soft: #DDE6D8;
  --eg-gold: #A9793C;
  --eg-gold-soft: #F1E5D0;
  --eg-border: rgba(30,36,28,0.13);
  --eg-shadow: 0 1px 2px rgba(30,36,28,0.06), 0 6px 18px -8px rgba(30,36,28,0.12);
  background: var(--eg-bg);
  color: var(--eg-ink);
  font-family: var(--font-public-sans), system-ui, sans-serif;
  line-height: 1.5;
  border-radius: 20px;
  padding: clamp(20px, 5vw, 44px);
}
.event-guide-wrap * { box-sizing: border-box; }
.eg-h { font-family: var(--font-fraunces), Georgia, serif; font-weight: 600; color: var(--eg-ink); margin: 0; text-wrap: balance; }
.eg-mono { font-family: var(--font-plex-mono), ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.eg-masthead { padding-bottom: 24px; border-bottom: 1px solid var(--eg-border); margin-bottom: 24px; }
.eg-eyebrow { font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--eg-gold); font-weight: 600; margin-bottom: 8px; }
.eg-masthead h1 { font-size: clamp(1.5rem, 4vw, 2.1rem); line-height: 1.15; }
.eg-venue { color: var(--eg-muted); font-size: 0.92rem; margin-top: 8px; }
.eg-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 1px; background: var(--eg-border); border: 1px solid var(--eg-border); border-radius: 12px; overflow: hidden; margin: 20px 0 32px; }
.eg-stat { background: var(--eg-surface); padding: 14px 16px; }
.eg-stat .l { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--eg-muted); margin-bottom: 5px; }
.eg-stat .v { font-family: var(--font-fraunces), serif; font-size: 1.15rem; font-weight: 600; }
.eg-stat .s { font-size: 0.75rem; color: var(--eg-muted); margin-top: 2px; }
.eg-section { margin: 34px 0; }
.eg-section-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
.eg-section-head h2 { font-size: 1.15rem; }
.eg-contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px,1fr)); gap: 24px; }
.eg-contact-heading { font-family: var(--font-public-sans); font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--eg-muted); margin-bottom: 10px; font-weight: 600; }
.eg-contact-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.eg-contact-list li { display: flex; justify-content: space-between; gap: 10px; padding-bottom: 9px; border-bottom: 1px solid var(--eg-border); font-size: 0.88rem; }
.eg-contact-list li:last-child { border-bottom: none; }
.eg-contact-role { display: block; font-size: 0.72rem; color: var(--eg-muted); margin-top: 1px; }
.eg-contact-detail { color: var(--eg-muted); text-align: right; white-space: nowrap; font-family: var(--font-plex-mono), monospace; font-size: 0.8rem; }
.eg-day { margin-bottom: 28px; }
.eg-day-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 12px; padding-bottom: 9px; border-bottom: 2px solid var(--eg-accent-soft); }
.eg-day-head .date { font-family: var(--font-fraunces), serif; font-size: 1.05rem; font-weight: 600; }
.eg-day-head .tag { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--eg-gold); background: var(--eg-gold-soft); padding: 3px 8px; border-radius: 20px; font-weight: 600; }
.eg-day.core { background: var(--eg-surface); border: 1px solid var(--eg-border); border-radius: 14px; padding: 18px clamp(14px,4vw,24px); box-shadow: var(--eg-shadow); }
.eg-day.core .eg-day-head { border-bottom-color: var(--eg-accent); }
.eg-event { display: grid; grid-template-columns: 68px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--eg-border); }
.eg-event:last-child { border-bottom: none; }
.eg-event .time { font-family: var(--font-plex-mono), monospace; font-size: 0.75rem; color: var(--eg-accent); padding-top: 2px; font-weight: 600; }
.eg-event .what { font-weight: 600; font-size: 0.92rem; }
.eg-event .where { color: var(--eg-muted); font-size: 0.8rem; margin-top: 1px; }
.eg-event .note { color: var(--eg-muted); font-size: 0.83rem; margin-top: 4px; line-height: 1.5; }
.eg-event .note strong { color: var(--eg-ink); font-weight: 600; }
.eg-menu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 16px; }
.eg-menu-card { background: var(--eg-surface); border: 1px solid var(--eg-border); border-radius: 12px; padding: 14px 16px; }
.eg-menu-card h3 { font-size: 0.94rem; margin-bottom: 2px; font-family: var(--font-fraunces), serif; font-weight: 600; }
.eg-menu-card .when { font-size: 0.74rem; color: var(--eg-muted); font-family: var(--font-plex-mono), monospace; }
.eg-menu-card ol { margin: 10px 0 0; padding-left: 16px; font-size: 0.86rem; display: flex; flex-direction: column; gap: 4px; }
.eg-flags { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.eg-flag { font-size: 0.68rem; background: var(--eg-accent-soft); color: var(--eg-accent); padding: 2px 8px; border-radius: 20px; font-weight: 600; }
.eg-split { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap: 20px; }
.eg-split .col { background: var(--eg-surface); border: 1px solid var(--eg-border); border-radius: 12px; padding: 16px 18px; }
.eg-split h3 { font-size: 0.92rem; margin-bottom: 10px; font-family: var(--font-fraunces), serif; font-weight: 600; }
.eg-split ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.eg-split li { font-size: 0.86rem; padding-left: 16px; position: relative; }
.eg-split li::before { content: "—"; position: absolute; left: 0; color: var(--eg-muted); }
.eg-notes-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 14px; }
.eg-note-card { border-left: 3px solid var(--eg-gold); background: var(--eg-surface); border-radius: 0 10px 10px 0; padding: 12px 14px; }
.eg-note-card .h { font-weight: 600; font-size: 0.86rem; margin-bottom: 3px; }
.eg-note-card p { margin: 0; font-size: 0.83rem; color: var(--eg-muted); line-height: 1.55; }
.eg-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--eg-border); font-size: 0.76rem; color: var(--eg-muted); }
@media (max-width: 480px) {
  .eg-event { grid-template-columns: 54px 1fr; }
  .eg-contact-list li { flex-direction: column; align-items: flex-start; gap: 2px; }
  .eg-contact-detail { text-align: left; }
}
`;

export function EventGuide({ content }: { content: EventContent }) {
  return (
    <div className={`event-guide-wrap ${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {content.eyebrow && <div className="eg-eyebrow">{content.eyebrow}</div>}
      {content.venueLine && (
        <div className="eg-masthead">
          <div className="eg-venue">{content.venueLine}</div>
        </div>
      )}

      {content.stats && content.stats.length > 0 && (
        <div className="eg-stats">
          {content.stats.map((s, i) => (
            <div key={i} className="eg-stat">
              <div className="l">{s.label}</div>
              <div className="v">{s.value}</div>
              {s.sub && <div className="s">{s.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {content.contacts && content.contacts.length > 0 && (
        <div className="eg-section">
          <div className="eg-section-head">
            <h2 className="eg-h">Key contacts</h2>
          </div>
          <div className="eg-contact-grid">
            {content.contacts.map((group, i) => (
              <div key={i}>
                <div className="eg-contact-heading">{group.heading}</div>
                <ul className="eg-contact-list">
                  {group.people.map((p, j) => (
                    <li key={j}>
                      <span>
                        <span>{p.name}</span>
                        <span className="eg-contact-role">{p.role}</span>
                      </span>
                      {p.detail && <span className="eg-contact-detail">{p.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.timeline && content.timeline.length > 0 && (
        <div className="eg-section">
          <div className="eg-section-head">
            <h2 className="eg-h">The timeline</h2>
          </div>
          {content.timeline.map((day, i) => (
            <div key={i} className={`eg-day ${day.core ? "core" : ""}`}>
              <div className="eg-day-head">
                <span className="date">{day.date}</span>
                {day.tag && <span className="tag">{day.tag}</span>}
              </div>
              <div>
                {day.events.map((e, j) => (
                  <div key={j} className="eg-event">
                    <div className="time">{e.time}</div>
                    <div>
                      <div className="what">{e.what}</div>
                      {e.where && <div className="where">{e.where}</div>}
                      {e.note && <div className="note">{e.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {content.menu && content.menu.length > 0 && (
        <div className="eg-section">
          <div className="eg-section-head">
            <h2 className="eg-h">Menu at a glance</h2>
          </div>
          <div className="eg-menu-grid">
            {content.menu.map((m, i) => (
              <div key={i} className="eg-menu-card">
                <h3>{m.title}</h3>
                {m.when && <div className="when">{m.when}</div>}
                <ol>
                  {m.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ol>
                {m.flags && m.flags.length > 0 && (
                  <div className="eg-flags">
                    {m.flags.map((f, j) => (
                      <span key={j} className="eg-flag">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {content.drinks && content.drinks.length > 0 && (
        <div className="eg-section">
          <div className="eg-section-head">
            <h2 className="eg-h">Drinks</h2>
          </div>
          <div className="eg-menu-grid">
            {content.drinks.map((d, i) => (
              <div key={i} className="eg-menu-card">
                <h3>{d.title}</h3>
                {d.when && <div className="when">{d.when}</div>}
                <ol>
                  {d.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ol>
                {d.flags && d.flags.length > 0 && (
                  <div className="eg-flags">
                    {d.flags.map((f, j) => (
                      <span key={j} className="eg-flag">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {content.providedBy && content.providedBy.length > 0 && (
        <div className="eg-section">
          <div className="eg-section-head">
            <h2 className="eg-h">Who&apos;s providing what</h2>
          </div>
          <div className="eg-split">
            {content.providedBy.map((group, i) => (
              <div key={i} className="col">
                <h3>{group.heading}</h3>
                <ul>
                  {group.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.notes && content.notes.length > 0 && (
        <div className="eg-section">
          <div className="eg-section-head">
            <h2 className="eg-h">Good to know</h2>
          </div>
          <div className="eg-notes-grid">
            {content.notes.map((n, i) => (
              <div key={i} className="eg-note-card">
                <div className="h">{n.heading}</div>
                <p>{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.footer && <div className="eg-footer">{content.footer}</div>}
    </div>
  );
}
