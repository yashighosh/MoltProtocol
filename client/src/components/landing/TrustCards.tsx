import { Halftone } from "./Halftone";
import { Reveal } from "../Reveal";

const CARDS = [
  ["inferred", "Inferred", "A plain-language reading of a module, tied to the lines that support it. It is a draft."],
  ["validated", "Validated", "A named person confirms or corrects that draft. Their identity and the time stay on the record."],
  ["flagged", "Flagged", "Where the code and the signed intent disagree, the conflict is ranked for review. It is not called a proven defect."],
] as const;

export function TrustCards() {
  return (
    <section className="section">
      <div className="container">
        <h2 className="display">Intent you can trust</h2>
        <div className="trust">
          {CARDS.map(([kind, title, copy], index) => (
            <Reveal key={title} delay={index * 0.05}>
              <article className={index === 2 ? "dark" : ""}>
                <Halftone kind={kind} />
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
