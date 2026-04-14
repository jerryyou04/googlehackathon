export interface DateRange {
  start?: Date;
  end?: Date;
}

export function getDateRange(
  range: string | undefined,
  from: string | undefined,
  to: string | undefined
): DateRange {
  const now = new Date();

  if (from || to) {
    return {
      start: from ? new Date(from) : undefined,
      end: to ? new Date(to + "T23:59:59") : undefined,
    };
  }

  switch (range) {
    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { start, end: now };
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { start, end: now };
    }
    case "90d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      return { start, end: now };
    }
    case "ytd": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: now };
    }
    case "1y": {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      return { start, end: now };
    }
    default:
      return {};
  }
}

export function buildPrismaDateFilter(dr: DateRange) {
  if (!dr.start && !dr.end) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (dr.start) filter.gte = dr.start;
  if (dr.end) filter.lte = dr.end;
  return filter;
}
