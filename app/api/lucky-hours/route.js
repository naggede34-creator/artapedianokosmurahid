import { NextResponse } from "next/server";
import { luckyHoursCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const col = await luckyHoursCol();
  const now = new Date();
  const hours = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false });
  const mins = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta", minute: "numeric" });
  const currentMinutes = parseInt(hours) * 60 + parseInt(mins);

  const configs = await col.find({ active: true }).toArray();

  for (const cfg of configs) {
    const startMinutes = cfg.startHour * 60;
    const endMinutes = cfg.endHour * 60;
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      const minutesLeft = endMinutes - currentMinutes;
      const totalMinutes = endMinutes - startMinutes;
      return NextResponse.json({
        active: true,
        discountPercent: cfg.discountPercent,
        label: cfg.label || `Lucky Hour ${cfg.startHour}:00–${cfg.endHour}:00`,
        minutesLeft,
        totalMinutes,
        endMinutes,
      });
    }
  }

  // Find next lucky hour
  let nextCfg = null;
  let minDiff = Infinity;
  for (const cfg of configs) {
    const startMinutes = cfg.startHour * 60;
    let diff = startMinutes - currentMinutes;
    if (diff < 0) diff += 24 * 60;
    if (diff < minDiff) { minDiff = diff; nextCfg = cfg; }
  }

  return NextResponse.json({
    active: false,
    next: nextCfg ? {
      label: nextCfg.label || `Lucky Hour ${nextCfg.startHour}:00–${nextCfg.endHour}:00`,
      startHour: nextCfg.startHour,
      endHour: nextCfg.endHour,
      discountPercent: nextCfg.discountPercent,
      minutesUntil: minDiff,
    } : null,
  });
}
