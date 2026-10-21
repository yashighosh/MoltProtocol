# Confidence and impact

These scores are computed in the repository. They are not taken from a language model's self-report.

## Intent confidence

`server/src/intent/confidence.ts`

The same inputs always produce the same score.

| Signal | Weight | What it measures |
| --- | --- | --- |
| Comment coverage | 0.28 | Comment characters divided by code characters |
| Naming clarity | 0.24 | Whether identifiers are readable words rather than one- or two-letter names |
| Nearby test | 0.18 | A `*.test.*` or `*.spec.*` file for the module is present in the ingest |
| Inverse complexity | 0.15 | Branch count against a budget of four branches per function |
| Import resolution | 0.15 | Relative imports that do not resolve inside the ingest lower the score |

Bands: high at 0.67 and above, medium at 0.40 and above, otherwise low.

Low confidence is a manual-review flag. It is not a claim that the summary is wrong, and high confidence is not a claim that it is true.

## Discrepancy impact

`server/src/discrepancy/compare.ts`

Detection runs only on summaries an expert has confirmed or corrected. Unreviewed summaries are counted and excluded.

Each rule compares static evidence with the validated text. None of the rules execute the program.

| Rule | Severity | Evidence |
| --- | --- | --- |
| discount-applied-after-tax | high | Intent says discount before tax, but the first tax call appears earlier in the source |
| tax-applied-more-than-once | high | Intent says the operation happens once, and the same tax callee is invoked more than once in one function |
| empty-catch | medium | An empty catch swallows an error the intent does not describe |
| unresolved-dependency | medium | A relative import does not resolve to a file in this ingest |
| unfinished-marker | low | TODO, FIXME, or HACK remains, and the intent does not mention unfinished work |

Impact = `0.50 * severity + 0.30 * centrality + 0.20 * intent confidence`.

Severity weights are high 1, medium 0.66, low 0.33. Centrality is the module's edge degree divided by the busiest module. Intent confidence weights are high 1, medium 0.75, low 0.45, so a conflict with a firmly stated intent ranks above the same conflict with a weakly stated one.

Rank 1 is the highest score. Ties keep the detection order.

A flagged row is a potential discrepancy. Marking it reviewed or confirmed is a human action. Static analysis does not prove runtime behavior.
