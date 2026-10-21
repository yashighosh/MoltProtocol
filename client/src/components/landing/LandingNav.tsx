import { Logo } from "../Logo";
import { PillButton } from "../PillButton";

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="landing-nav">
      <Logo />
      <nav aria-label="Page">
        <a href="#product">Product</a>
        <a href="#method">Method</a>
        <a href="#features">Features</a>
        <a href="#try">Try it</a>
      </nav>
      <div className="nav-actions">
        <a href="/login">Sign in</a>
        <PillButton to={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Open workspace" : "Get started"}</PillButton>
      </div>
    </header>
  );
}
