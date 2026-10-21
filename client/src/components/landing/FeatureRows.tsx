const ROWS = [
  {
    title: "Confirmed edges stay solid.",
    copy: "Sample. billing/invoice.js imports tax.js and discount.js. The import of ../payments/ledger.js has no matching file, so that edge stays dashed.",
    visual: "map",
  },
  {
    title: "Low confidence does not fade into the background.",
    copy: "Sample. util/scratch.js is a low-confidence module. The warning stays on the summary until a person reviews it.",
    visual: "intent",
  },
  {
    title: "Every intent is signed by a named person.",
    copy: "Confirmation stores the demo identity, the time, and the previous text. The label Demo identity stays visible.",
    visual: "review",
  },
  {
    title: "The double tax sits next to the sentence that forbids it.",
    copy: "Sample. The invoice comments say tax is applied once, after the discount. The function calls applyTax, then applyDiscount, then applyTax again, and the catch around the ledger call is empty.",
    visual: "diff",
  },
];

export function FeatureRows() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        {ROWS.map((row, index) => (
          <div className={`feature-row${index % 2 ? " reverse" : ""}`} key={row.title}>
            <div className="stack">
              <p className="eyebrow">Sample behavior</p>
              <h2>{row.title}</h2>
              <p>{row.copy}</p>
            </div>
            <div className="browser">
              <div className="browser-bar" aria-hidden="true"><i /><i /><i /></div>
              <div style={{ padding: 16 }}>
                {row.visual === "diff" ? (
                  <div className="split">
                    <pre className="code"><div><span className="ln"> </span><code>applyTax(subtotal)</code></div><div className="hit"><span className="ln"> </span><code>applyDiscount(taxed)</code></div><div className="hit"><span className="ln"> </span><code>applyTax(discounted)</code></div></pre>
                    <p>Validated intent: apply the customer discount before tax. Tax is applied exactly once.</p>
                  </div>
                ) : row.visual === "intent" ? (
                  <div className="stack">
                    <span className="badge badge-error">low confidence</span>
                    <strong>Manual review required</strong>
                    <p className="path">util/scratch.js:1-1</p>
                  </div>
                ) : row.visual === "review" ? (
                  <p>Reviewed by Ada Okonkwo (Demo identity).</p>
                ) : (
                  <p className="path">invoice.js → tax.js confirmed<br />invoice.js → ledger.js unresolved</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
