import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import loadingAnimation from "@/shared/assets/teste.json";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6">
      <div className="w-64 h-64 flex items-center justify-center select-none pointer-events-none">
        <DotLottieReact
          data={loadingAnimation}
          loop
          autoplay
          className="w-full h-full object-contain"
        />
      </div>
      <p className="mt-4 text-lg font-medium text-muted-foreground animate-pulse">
        Carregando...
      </p>
    </div>
  );
}
