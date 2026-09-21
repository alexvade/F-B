import type { EventContent, TimelineDay } from "@/lib/event-content";
import { EmojiText } from "@/components/emoji-text";
import { fraunces, publicSans, plexMono, GUIDE_STYLES as STYLES } from "@/components/guide-styles";

// A single timeline day, styled exactly like a day card inside the full
// guide — used on the Dashboard to surface "what's on today" without
// having to open the guide itself.
export function EventDayCard({ eventTitle, day }: { eventTitle: string; day: TimelineDay }) {
  return (
    <div
      className={`event-guide-wrap ${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}
      style={{ padding: 0, background: "transparent", borderRadius: 0 }}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="eg-day core" style={{ marginBottom: 0 }}>
        <div className="eg-eyebrow" style={{ marginBottom: 6 }}>
          {eventTitle}
        </div>
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
    </div>
  );
}

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
            <div key={i} className="eg-day core">
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
                <div className="eg-course-list">
                  {m.courses.map((course, ci) => (
                    <div key={ci} className="eg-course">
                      {course.map((line, li) => (
                        <div key={li} className="eg-course-line">
                          {line.qty != null && <span className="qty">{line.qty}</span>}
                          <span>{line.text}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
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
                <h3>
                  <EmojiText text={group.heading} />
                </h3>
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
