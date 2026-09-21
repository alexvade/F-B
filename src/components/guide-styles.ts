import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";

export const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-fraunces" });
export const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-public-sans" });
export const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-plex-mono" });

// Shared editorial look (serif headings, sage/gold palette) for both the
// Events guide and the Menus guide — a printed-guide feel distinct from the
// app's navy/orange dashboard system. Scoped under .event-guide-wrap so
// nothing here leaks into the rest of the app, and vice versa. Menu-specific
// classes (eg-item-*) live alongside the event ones since both guides share
// the same wrapper and tokens.
export const GUIDE_STYLES = `
.event-guide-wrap {
  --eg-bg: #FFFFFF;
  --eg-surface: #FFFFFF;
  --eg-ink: #000000;
  --eg-muted: #000000;
  --eg-accent: #000000;
  --eg-accent-soft: #FFFFFF;
  --eg-gold: #000000;
  --eg-gold-soft: #FFFFFF;
  --eg-border: rgba(0,0,0,0.2);
  --eg-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 6px 18px -8px rgba(0,0,0,0.12);
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
.eg-menu-card { background: var(--eg-surface); border: 1px solid var(--eg-border); border-radius: 14px; padding: 14px 16px; box-shadow: var(--eg-shadow); }
.eg-menu-card h3 { font-size: 0.94rem; margin-bottom: 2px; font-family: var(--font-fraunces), serif; font-weight: 600; }
.eg-menu-card .when { font-size: 0.74rem; color: var(--eg-muted); font-family: var(--font-plex-mono), monospace; }
.eg-course-list { margin-top: 10px; display: flex; flex-direction: column; }
.eg-course { padding: 8px 0; border-bottom: 1px solid var(--eg-border); display: flex; flex-direction: column; gap: 4px; }
.eg-course:last-child { border-bottom: none; padding-bottom: 0; }
.eg-course:first-child { padding-top: 0; }
.eg-course-line { display: flex; gap: 8px; font-size: 0.86rem; align-items: baseline; }
.eg-course-line .qty { font-family: var(--font-plex-mono), monospace; font-weight: 600; color: var(--eg-accent); min-width: 16px; text-align: right; flex-shrink: 0; }
.eg-flags { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
.eg-flag { font-size: 0.68rem; background: var(--eg-accent-soft); color: var(--eg-accent); padding: 2px 8px; border-radius: 20px; font-weight: 600; }
.eg-split { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap: 20px; }
.eg-split .col { background: var(--eg-surface); border: 1px solid var(--eg-border); border-radius: 14px; padding: 16px 18px; box-shadow: var(--eg-shadow); }
.eg-split h3 { font-size: 0.92rem; margin-bottom: 10px; font-family: var(--font-fraunces), serif; font-weight: 600; }
.eg-split ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.eg-split li { font-size: 0.86rem; padding-left: 16px; position: relative; }
.eg-split li::before { content: "—"; position: absolute; left: 0; color: var(--eg-muted); }
.eg-notes-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 14px; }
.eg-note-card { border-left: 3px solid var(--eg-gold); background: var(--eg-surface); border-radius: 0 10px 10px 0; padding: 12px 14px; box-shadow: var(--eg-shadow); }
.eg-note-card .h { font-weight: 600; font-size: 0.86rem; margin-bottom: 3px; }
.eg-note-card p { margin: 0; font-size: 0.83rem; color: var(--eg-muted); line-height: 1.55; }
.eg-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--eg-border); font-size: 0.76rem; color: var(--eg-muted); }
.eg-item-list { display: flex; flex-direction: column; }
.eg-item { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--eg-border); }
.eg-item:last-child { border-bottom: none; }
.eg-item .info { min-width: 0; }
.eg-item .name { font-family: var(--font-fraunces), serif; font-weight: 600; font-size: 0.98rem; }
.eg-item .desc { color: var(--eg-muted); font-size: 0.84rem; margin-top: 2px; line-height: 1.5; }
.eg-item .price { font-family: var(--font-plex-mono), monospace; font-size: 0.88rem; font-weight: 600; white-space: nowrap; padding-top: 2px; }
.eg-section-intro { color: var(--eg-muted); font-size: 0.88rem; margin: -6px 0 16px; line-height: 1.6; }
.eg-intro-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap: 20px; margin-bottom: 8px; }
.eg-intro-card h3 { font-size: 0.92rem; margin-bottom: 8px; font-family: var(--font-fraunces), serif; font-weight: 600; }
.eg-intro-card p { color: var(--eg-muted); font-size: 0.86rem; line-height: 1.6; margin: 0 0 10px; }
.eg-intro-card p:last-child { margin-bottom: 0; }
@media (max-width: 480px) {
  .eg-event { grid-template-columns: 54px 1fr; }
  .eg-contact-list li { flex-direction: column; align-items: flex-start; gap: 2px; }
  .eg-contact-detail { text-align: left; }
  .eg-item { flex-direction: column; gap: 2px; }
}
`;
