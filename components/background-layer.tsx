"use client";

import { useApp } from "@/components/app-provider";

export function BackgroundLayer() {
  const { state } = useApp();
  const id = state?.settings.backgroundImageId;
  const bg = state?.settings.backgrounds.find((item) => item.id === id);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg.url} alt="" className="h-full w-full object-cover scale-105 blur-[2px]" />
      ) : (
        <div className="h-full w-full bg-background" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f7f6f3]/92 via-[#f7f6f3]/88 to-[#f3f1ec]/94" />
    </div>
  );
}
