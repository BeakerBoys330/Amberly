import { useState } from "react";
import { Check } from "lucide-react";
import { store } from "./planner.js";

// First-launch agreement: 21+, local law, Terms + Privacy. Shown again whenever
// LEGAL_VERSION changes (bump it when terms.html or privacy.html change materially).
export const CONSENT_KEY = "amberly.consent.v1";
export const LEGAL_VERSION = "2026-10-21";
export const hasConsent = () => store.get(CONSENT_KEY, null)?.version === LEGAL_VERSION;

const LINK = { color: "#b07b3e", fontWeight: 600 };
const ITEMS = [
  ["age", "I'm 21 or older"],
  ["law", "Growing cannabis at home is legal where I live, and I'll follow my local laws"],
  ["terms", <>I agree to the <a href="/terms.html" target="_blank" rel="noreferrer" style={LINK}>Terms of Use</a> and <a href="/privacy.html" target="_blank" rel="noreferrer" style={LINK}>Privacy Policy</a></>],
];

export default function LegalGate({ onAccept }) {
  const [checked, setChecked] = useState({});
  const all = ITEMS.every(([k]) => checked[k]);
  const accept = () => {
    store.set(CONSENT_KEY, { version: LEGAL_VERSION, acceptedAt: new Date().toISOString() });
    onAccept();
  };

  return (
    <>
      <div className="tv-header">
        <div className="tv-eyebrow">Before you start</div>
        <div className="tv-title">Amberly</div>
        <div className="tv-subtitle">A harvest-timing and grow-planning tool for adults.</div>
      </div>

      <div className="tv-card"><div className="tv-card-pad">
        <div className="tv-section-title" style={{ marginBottom: 10 }}>The short version</div>
        <div className="tv-tip" style={{ marginTop: 0 }}>
          • Your grows, notes, and photos stay on this device unless you choose to share them with BeakerBoys.<br />
          • Trichome readings are a guide, not a lab test. You make the final call.<br />
          • Nothing here is medical, legal, or professional advice.<br />
          • Amberly never sells or links to cannabis products.<br />
          • This is early test software. It may have bugs, and data can be lost.
        </div>
      </div></div>

      <div className="tv-choice">
        {ITEMS.map(([k, label]) => (
          <button key={k} type="button" className={`tv-choice-btn ${checked[k] ? "active" : ""}`}
            onClick={(e) => { if (e.target.tagName !== "A") setChecked((c) => ({ ...c, [k]: !c[k] })); }}>
            <span className="tv-choice-text"><span className="tv-choice-desc" style={{ fontSize: 15, color: "#2b2622" }}>{label}</span></span>
            <span className="tv-choice-check"><Check size={14} color="#fff" strokeWidth={3} /></span>
          </button>
        ))}
      </div>

      <button className="tv-btn tv-btn-primary" disabled={!all} onClick={accept}>Agree and continue</button>
      <div className="tv-disclaimer" style={{ marginTop: 12 }}>
        If you're under 21, or home growing isn't legal where you live, please don't use Amberly.
      </div>
    </>
  );
}
