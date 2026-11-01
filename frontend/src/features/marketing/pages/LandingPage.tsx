import { CTASection } from "@/features/marketing/components/CTASection";
import { FeaturesSection } from "@/features/marketing/components/FeaturesSection";
import { Footer } from "@/features/marketing/components/Footer";
import { HeroSection } from "@/features/marketing/components/HeroSection";
import { HowItWorks } from "@/features/marketing/components/HowItWorks";
import { Navbar } from "@/features/marketing/components/Navbar";
import TeamSection from "@/features/marketing/components/TeamSection";

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
