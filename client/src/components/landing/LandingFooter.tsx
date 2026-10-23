import { Logo } from "../Logo";

export function LandingFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <Logo inverse />
        <nav aria-label="Footer" className="row">
          <a href="#product">Product</a>
          <a href="#method">Method</a>
          <a href="#features">Features</a>
          <a href="#try">Try it</a>
          <a href="/login">Sign in</a>
        </nav>
        <p>Modernize with the business logic intact.</p>
      </div>
    </footer>
  );
}
