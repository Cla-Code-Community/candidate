import LeftSide from "@/features/auth/components/AuthVisualPanel";
import RightSide from "@/features/auth/components/LoginFormPanel";

export default function LoginPage() {
  return (
    <section className="relative flex min-h-screen w-full items-stretch justify-center overflow-x-hidden">

      <LeftSide />

      <RightSide />

    </section>
  )
}
