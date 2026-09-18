import type { MenuContent } from "@/lib/menu-content";
import { fraunces, publicSans, plexMono, GUIDE_STYLES } from "@/components/guide-styles";

export function MenuGuide({ content }: { content: MenuContent }) {
  return (
    <div className={`event-guide-wrap ${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: GUIDE_STYLES }} />

      {content.eyebrow && <div className="eg-eyebrow">{content.eyebrow}</div>}
      {content.venueLine && (
        <div className="eg-masthead">
          <div className="eg-venue">{content.venueLine}</div>
        </div>
      )}

      {content.intro && content.intro.length > 0 && (
        <div className="eg-intro-grid">
          {content.intro.map((block, i) => (
            <div key={i} className="eg-intro-card">
              <h3 className="eg-h">{block.heading}</h3>
              {block.body.split("\n\n").map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </div>
          ))}
        </div>
      )}

      {content.sections.map((section, i) => (
        <div key={i} className="eg-section">
          <div className="eg-section-head">
            <h2 className="eg-h">{section.heading}</h2>
          </div>
          {section.intro && <p className="eg-section-intro">{section.intro}</p>}
          <div className="eg-item-list">
            {section.items.map((item, j) => (
              <div key={j} className="eg-item">
                <div className="info">
                  <div className="name">{item.name}</div>
                  {item.description && <div className="desc">{item.description}</div>}
                  {item.flags && item.flags.length > 0 && (
                    <div className="eg-flags">
                      {item.flags.map((f, k) => (
                        <span key={k} className="eg-flag">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {item.price && <div className="price">{item.price}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {content.footer && <div className="eg-footer">{content.footer}</div>}
    </div>
  );
}
