import { CTASection } from "@/domains/marketing/presentation/components/CTASection";
import { FeaturesSection } from "@/domains/marketing/presentation/components/FeaturesSection";
import { Footer } from "@/domains/marketing/presentation/components/Footer";
import { HeroSection } from "@/domains/marketing/presentation/components/HeroSection";
import { HowItWorks } from "@/domains/marketing/presentation/components/HowItWorks";
import { Navbar } from "@/domains/marketing/presentation/components/Navbar";
import TeamSection from "@/domains/marketing/presentation/components/TeamSection";

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen  text-gray-900 font-sans selection:bg-emerald-500/30">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <TeamSection/>
        <HowItWorks />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
