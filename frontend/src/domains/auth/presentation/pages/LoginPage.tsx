import LeftSide from "@/domains/auth/presentation/components/AuthVisualPanel";
import RightSide from "@/domains/auth/presentation/components/LoginFormPanel";

export default function LoginPage() {
  return (
    <section className="relative flex min-h-screen w-full items-stretch justify-center overflow-x-hidden">

      <LeftSide />

      <RightSide />

    </section>
  )
}
