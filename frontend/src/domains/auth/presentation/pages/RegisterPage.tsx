import LeftSide from "@/domains/auth/presentation/components/AuthVisualPanel";
import RegisterSide from "@/domains/auth/presentation/components/RegisterFormPanel";


export default function RegisterPage() {
    return (
      <section className="relative flex min-h-screen w-full items-stretch justify-center overflow-x-hidden">
        <LeftSide />
        <RegisterSide />
      </section>
    )
  }
