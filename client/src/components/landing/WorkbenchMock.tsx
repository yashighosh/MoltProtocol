import { PillButton } from "../PillButton";
import { Reveal } from "../Reveal";

export function WorkbenchMock({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container grid-2">
        <Reveal>
          <div className="stack">
            <h2 className="display">See the module before you trust the sentence.</h2>
            <p className="lead">The workbench keeps the map, the draft intent, and the confidence label on one surface. This frame is labeled Sample. It illustrates the bundled billing modules, not a live project count.</p>
            <PillButton to={signedIn ? "/dashboard" : "/login"}>Get started</PillButton>
          </div>
        </Reveal>
        <div className="browser" aria-label="Sample workbench preview">
          <div className="browser-bar" aria-hidden="true"><i /><i /><i /></div>
          <div className="mock-body">
            <div className="mock-side">
              <strong style={{ color: "var(--night-text)" }}>Sample</strong>
              <span>Ingest</span><span>Map</span><span>Intent</span><span>Review</span><span>Compare</span>
            </div>
            <div className="mock-main">
              <svg viewBox="0 0 360 180" role="img" aria-label="Sample module map">
                <line x1="40" y1="90" x2="150" y2="40" stroke="#263b50" strokeWidth="1.5" />
                <line x1="40" y1="90" x2="150" y2="140" stroke="#263b50" strokeWidth="1.5" />
                <line x1="40" y1="90" x2="250" y2="90" stroke="#7c5e17" strokeWidth="1.5" strokeDasharray="5 4" />
                <rect x="10" y="72" width="90" height="32" rx="10" fill="#263b50" />
                <rect x="150" y="24" width="70" height="32" rx="10" fill="#2f6040" />
                <rect x="150" y="124" width="86" height="32" rx="10" fill="#2a557f" />
                <rect x="250" y="74" width="90" height="32" rx="10" fill="none" stroke="#7c5e17" />
                <text x="18" y="92" fill="#f6f1e7" fontSize="11">invoice.js</text>
                <text x="164" y="44" fill="#f6f1e7" fontSize="11">tax.js</text>
                <text x="158" y="144" fill="#f6f1e7" fontSize="11">discount.js</text>
                <text x="258" y="94" fill="#7c5e17" fontSize="11">ledger.js</text>
              </svg>
            </div>
            <aside className="stack" style={{ padding: 16 }}>
              <p className="eyebrow">Sample</p>
              <strong>billing/invoice.js</strong>
              <span className="badge badge-preserved"><i />high confidence</span>
              <p>Comments say the discount comes before tax, and tax is applied once.</p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
