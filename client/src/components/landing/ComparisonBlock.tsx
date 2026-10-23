export function ComparisonBlock() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <h2 className="display">Two ways to modernize</h2>
        <div className="compare">
          <article className="old">
            <h3>Line-by-line rewrite</h3>
            <p>The new code follows the old code statement by statement. Nobody records what the business rule was supposed to be, so a mismatch has nowhere to show up.</p>
          </article>
          <article className="next">
            <h3>Intent-first modernization</h3>
            <p>Read the structure, draft the intent, get a named sign-off, then flag the conflicts. Modernize with the business logic intact.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
