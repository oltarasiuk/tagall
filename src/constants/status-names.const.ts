import { ItemStatus } from "@prisma/client";
import {
  Bookmark,
  CalendarClock,
  Check,
  Eye,
  type LucideIcon,
  Trash2,
} from "lucide-react";

export const STATUS_NAMES: Record<ItemStatus, string> = {
  ABANDONED: "Abandoned",
  COMPLETED: "Completed",
  WAITING: "Waiting",
  INPROGRESS: "In Progress",
  NOTSTARTED: "Not Started",
} as const;

export const STATUS_ICONS: Record<ItemStatus, LucideIcon> = {
  ABANDONED: Trash2,
  COMPLETED: Check,
  WAITING: CalendarClock,
  INPROGRESS: Eye,
  NOTSTARTED: Bookmark,
} as const;

export const STATUS_VALUES = [
  ItemStatus.ABANDONED,
  ItemStatus.NOTSTARTED,
  ItemStatus.INPROGRESS,
  ItemStatus.WAITING,
  ItemStatus.COMPLETED,
] as const;

export const STATUS_COLORS: Record<ItemStatus, string> = {
  COMPLETED: "text-emerald-400",
  INPROGRESS: "text-sky-400",
  WAITING: "text-amber-400",
  NOTSTARTED: "text-slate-400",
  ABANDONED: "text-rose-400",
} as const;

export const STATUS_CHART_COLORS: Record<ItemStatus, string> = {
  COMPLETED: "#34d399",
  INPROGRESS: "#38bdf8",
  WAITING: "#fbbf24",
  NOTSTARTED: "#94a3b8",
  ABANDONED: "#fb7185",
} as const;
