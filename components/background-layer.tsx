"use client";

import { useApp } from "@/components/app-provider";

export function BackgroundLayer() {
  const { state } = useApp();
  const id = state?.settings.backgroundImageId;
  const bg = state?.settings.backgrounds.find((item) => item.id === id);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f3efe6]">
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg.url}
          alt=""
          className="absolute inset-[-18%] h-[136%] w-[136%] object-cover opacity-[0.38] blur-[52px]"
        />
      ) : null}
      <div className="absolute inset-0 bg-[#f4f0e8]/78" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#f7f3eb]/50 via-transparent to-[#efe8dc]/90" />
      <div className="paper-grain absolute inset-0" />
    </div>
  );
}
