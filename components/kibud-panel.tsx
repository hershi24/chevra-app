"use client";

import { ChevronDown, ChevronUp, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { kibudOrder } from "@/lib/kibud";
import { cn } from "@/lib/utils";

const PANEL = "overflow-hidden rounded-[1.4rem] border border-[#d5dbe3] bg-[#fbfcfd]";

export function KibudPanel() {
  const { state, act } = useApp();
  if (!state) return null;
  const order = kibudOrder(state);
  const included = new Set(order);
  const waiting = state.members.filter((member) => !included.has(member.id));

  async function save(memberIds: string[]) {
    try {
      await act({ type: "setKibudRotation", memberIds });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = order.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    void save(next);
  }

  return (
    <div className={cn(PANEL, "mb-4")}>
      <div className="flex items-center gap-3.5 px-4 py-4 md:px-5">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-[#f5f0e7] text-primary">
          <UtensilsCrossed className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px]">תורנות כיבוד</div>
          <div className="text-[12.5px] font-light leading-5 text-muted-foreground">
            הסדר קובע מי התורן בחברה הבאה, ומי בא אחריו.
          </div>
        </div>
      </div>
      <ul className="border-t border-[#e9ecef]">
        {order.map((id, index) => {
          const member = state.members.find((item) => item.id === id);
          if (!member) return null;
          return (
            <li key={id} className="flex items-center gap-2 border-b border-[#e9ecef] px-4 py-2.5 last:border-b-0 md:px-5">
              <span className="w-5 text-[12px] tabular-nums text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[14px]">{member.displayName}</span>
              <button type="button" className="grid size-8 place-items-center rounded-full text-[#6b7280] hover:bg-black/[0.04]" aria-label="למעלה" onClick={() => move(index, -1)}>
                <ChevronUp className="size-4" />
              </button>
              <button type="button" className="grid size-8 place-items-center rounded-full text-[#6b7280] hover:bg-black/[0.04]" aria-label="למטה" onClick={() => move(index, 1)}>
                <ChevronDown className="size-4" />
              </button>
              <button type="button" className="rounded-full px-2.5 py-1 text-[12px] text-[#a4453a] hover:bg-[#a4453a]/5" onClick={() => void save(order.filter((item) => item !== id))}>
                הורדה
              </button>
            </li>
          );
        })}
      </ul>
      {waiting.length ? (
        <div className="flex flex-wrap gap-1.5 border-t border-[#e9ecef] px-4 py-3 md:px-5">
          {waiting.map((member) => (
            <button
              key={member.id}
              type="button"
              className="rounded-full border border-[#d5dbe3] bg-white px-3 py-1 text-[12.5px]"
              onClick={() => void save([...order, member.id])}
            >
              {member.displayName}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
