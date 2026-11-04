import { useAuth } from "../../auth";
import { PillButton } from "../PillButton";

export function LandingHero() {
  const { user } = useAuth();

  return (
    <section className="hero" id="product">
      <div className="hero-mesh" aria-hidden="true" />
      <div className="container">
        <p className="eyebrow">Intent-aware modernization</p>
        <h1>Understand the code before you replace it.</h1>
        <p className="sub">Legacy systems carry rules nobody wrote down.</p>
        <div className="row">
          <PillButton to={user ? "/dashboard" : "/login"}>Get started</PillButton>
          <PillButton href="#method" variant="ghost">See how it works</PillButton>
        </div>
      </div>
    </section>
  );
}
