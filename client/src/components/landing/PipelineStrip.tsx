import { motion } from "framer-motion";
import { BadgeCheck, FileSearch, GitCompare, Share2, Upload, type LucideIcon } from "lucide-react";
import { CountUp } from "../CountUp";

const STEPS: { icon: LucideIcon; title: string; copy: string }[] = [
  { icon: Upload, title: "Ingest", copy: "Take a zip, a file set, or an https Git URL. Unsupported and corrupted files stay listed with a reason." },
  { icon: Share2, title: "Map", copy: "Draw confirmed imports and calls. A missing file stays a dashed edge." },
  { icon: FileSearch, title: "Summarize", copy: "Write a plain-language intent and a low, medium, or high confidence." },
  { icon: BadgeCheck, title: "Validate", copy: "A signed-in person confirms or corrects it. The name on the session is the name on the record." },
  { icon: GitCompare, title: "Compare", copy: "Rank places where the code and the validated intent disagree." },
];

export function PipelineStrip() {
  return (
    <section className="section" id="features">
      <div className="container">
        <p className="eyebrow"><CountUp to={5} /> stages</p>
        <h2 className="display">From a codebase to a reviewed conflict</h2>
        <div className="pipeline">
          <motion.div className="pipeline-line" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
          {STEPS.map(({ icon: Icon, title, copy }) => (
            <article key={title}>
              <Icon size={18} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
