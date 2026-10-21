import { Link } from "react-router-dom";
import { IntroGate } from "../components/IntroGate";
import { useAuth } from "../auth";

const STEPS = [
  ["01 Ingest", "Submit the legacy codebase. Unsupported and corrupted files are flagged, and the current stage stays visible."],
  ["02 Map", "Read the dependency and call structure. Select a module to see callers and callees, then export the map."],
  ["03 Summarize", "Get a plain-language intent for each module, with low, medium, or high confidence and the source lines behind it."],
  ["04 Validate", "A person who knows the system confirms or corrects that inference. Their identity and the time are kept."],
  ["05 Compare", "Flag where the code and the validated intent disagree, ranked by impact, with both sides shown together."],
];

export function LandingPage() {
  const { user } = useAuth();
  const next = user ? "/workspace" : "/login";
  return (
    <IntroGate>
      <div className="landing">
        <header className="topbar">
          <p className="wordmark">MoltProtocol</p>
          <Link className="button" to={next}>{user ? "Open workspace" : "Get started"}</Link>
        </header>
        <section className="hero">
          <div className="reveal">
            <h1>Recover the business intent in legacy code before you modernize it.</h1>
            <p className="lede">MoltProtocol is an engineering workbench for teams who cannot trust a line-by-line rewrite. It ingests a codebase, shows its structure, drafts what each module appears to mean, and refuses to treat that draft as fact until someone with institutional knowledge signs it.</p>
            <div className="row">
              <Link className="button" to={next}>Get started</Link>
              <a className="button secondary" href="#how">How the workbench moves</a>
            </div>
          </div>
          <div className="hero-graphic reveal" aria-hidden="true">
            <svg viewBox="0 0 420 220">
              <path d="M20 170 L90 80 L150 140 L230 50 L310 130 L400 40" fill="none" stroke="#B18B42" strokeWidth="2" />
              <path d="M20 170 L90 80 L150 140 L230 50 L310 130 L400 40" fill="none" stroke="#F0E9DC" strokeWidth="1" strokeDasharray="4 6" />
              <rect x="70" y="64" width="48" height="22" fill="#F0E9DC" />
              <rect x="210" y="36" width="48" height="22" fill="#F0E9DC" />
              <rect x="286" y="114" width="48" height="22" fill="#A4B29A" />
            </svg>
          </div>
        </section>
        <section className="section" id="how">
          <h2>From an undocumented codebase to a reviewed discrepancy</h2>
          <div className="steps">
            {STEPS.map(([title, copy]) => (
              <article key={title} className="step reveal">
                <strong>{title}</strong>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="section">
          <h2>What the workbench looks like</h2>
          <p className="lede">These frames are drawn from the Sprint 1 interface. They are not a customer deployment and they are not stock photography.</p>
          <div className="preview-grid">
            <div className="preview-frame">
              <div className="row"><strong>Ingestion summary</strong><span className="badge badge-preserved"><i />complete</span></div>
              <p className="mono">9 files · JavaScript · 2 flagged</p>
              <p className="preview-caption">Interface preview — ingestion summary with rejected files kept visible.</p>
            </div>
            <div className="preview-frame">
              <div className="row"><strong>Dependency map</strong><span className="badge badge-attention"><i />unresolved</span></div>
              <p className="mono">invoice.js → tax.js confirmed · ledger.js missing</p>
              <p className="preview-caption">Interface preview — confirmed edges are solid, missing targets stay dashed.</p>
            </div>
            <div className="preview-frame">
              <div className="row"><strong>Intent</strong><span className="badge badge-error"><i />low confidence</span></div>
              <p>Manual review required. The reading is inferred from names and comments.</p>
              <p className="preview-caption">Interface preview — low confidence is a label, not only a color.</p>
            </div>
            <div className="preview-frame">
              <div className="row"><strong>Review</strong><span className="badge badge-navy"><i />demo identity</span></div>
              <p className="mono">Confirmed by Ada Okonkwo · Demo identity</p>
              <p className="preview-caption">Interface preview — the same demo identity used at sign-in.</p>
            </div>
            <div className="preview-frame">
              <div className="row"><strong>Discrepancies</strong><span className="badge badge-error"><i />high impact</span></div>
              <p className="mono">1 · discount applied after tax</p>
              <p>The code excerpt and the validated intent sit together. The rank is a review order, not proof of a runtime defect.</p>
              <p className="preview-caption">Interface preview — comparison after expert sign-off.</p>
            </div>
          </div>
        </section>
      </div>
    </IntroGate>
  );
}
