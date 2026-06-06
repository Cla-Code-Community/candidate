import LeftSide from "@/components/login/LeftSide";
import RightSide from "@/components/login/RigthSide";

export default function LoginPage() {
  return (
    <section className="relative flex min-h-screen w-full items-stretch justify-center overflow-x-hidden">

      <LeftSide />

      <RightSide />

    </section>
  )
}
