import { useAuth } from "../auth";
import { IntroGate } from "../components/IntroGate";
import { ComparisonBlock } from "../components/landing/ComparisonBlock";
import { FeatureRows } from "../components/landing/FeatureRows";
import { LandingFooter } from "../components/landing/LandingFooter";
import { LandingHero } from "../components/landing/LandingHero";
import { LandingNav } from "../components/landing/LandingNav";
import { PipelineStrip } from "../components/landing/PipelineStrip";
import { ReadsPrinciple } from "../components/landing/ReadsPrinciple";
import { SampleAccess } from "../components/landing/SampleAccess";
import { StoryBlock } from "../components/landing/StoryBlock";
import { TrustCards } from "../components/landing/TrustCards";
import { WorkbenchMock } from "../components/landing/WorkbenchMock";

export function LandingPage() {
  const { user } = useAuth();
  return (
    <IntroGate>
      <div className="landing">
        <LandingNav signedIn={Boolean(user)} />
        <LandingHero />
        <TrustCards />
        <WorkbenchMock signedIn={Boolean(user)} />
        <StoryBlock />
        <PipelineStrip />
        <FeatureRows />
        <ComparisonBlock />
        <ReadsPrinciple />
        <SampleAccess />
        <LandingFooter />
      </div>
    </IntroGate>
  );
}
