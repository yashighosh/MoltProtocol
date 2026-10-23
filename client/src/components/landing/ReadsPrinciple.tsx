import { CountUp } from "../CountUp";

const READS = ["JavaScript", "TypeScript", "GitHub", "GitLab", "Bitbucket", "Zip upload"];

export function ReadsPrinciple() {
  return (
    <section className="section on-dark" style={{ background: "var(--night-950)" }}>
      <div className="container">
        <p className="eyebrow"><CountUp to={3} /> confidence levels</p>
        <h2 className="display">What this sprint can read</h2>
        <div className="reads">
          {READS.map((item) => <article key={item}>{item}</article>)}
        </div>
        <div className="principle">
          <div className="mesh hero-mesh" aria-hidden="true" />
          <p className="copy">Inference is not sign-off.</p>
        </div>
      </div>
    </section>
  );
}
