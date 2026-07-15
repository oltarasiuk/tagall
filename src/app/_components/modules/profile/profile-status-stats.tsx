"use client";
import {
  Header,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../ui";
import type { ItemsStatsType } from "../../../../server/api/modules/item/types";
import { GrainCardContainer } from "../../shared";
import { Label, Pie, PieChart } from "recharts";
import {
  STATUS_CHART_COLORS,
  STATUS_NAMES,
  STATUS_VALUES,
} from "../../../../constants/status-names.const";

type Props = {
  all: number;
  statusStats: ItemsStatsType["status"];
};

const ProfileStatusStats = (props: Props) => {
  const { all, statusStats } = props;

  const sortedStatusStats = [...statusStats].sort((a, b) => {
    return STATUS_VALUES.indexOf(a.status) - STATUS_VALUES.indexOf(b.status);
  });

  return (
    <GrainCardContainer className="h-[320px] w-full flex-col p-4">
      <div className="flex h-full flex-col">
        <Header vtag="h5">By Status</Header>
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-center lg:justify-center">
          <div className="flex flex-col justify-center gap-3">
            {sortedStatusStats.map((stat) => (
              <div key={stat.status} className="flex items-center gap-2">
                <div
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: STATUS_CHART_COLORS[stat.status],
                  }}
                />
                <span className="min-w-[110px] text-sm font-medium">
                  {STATUS_NAMES[stat.status]}
                </span>
                <span className="text-base font-bold">{stat.count}</span>
              </div>
            ))}
          </div>
          <ChartContainer
            config={{
              count: {
                label: "count",
              },
              ABANDONED: {
                label: "Abandoned",
                color: STATUS_CHART_COLORS.ABANDONED,
              },
              COMPLETED: {
                label: "Completed",
                color: STATUS_CHART_COLORS.COMPLETED,
              },
              INPROGRESS: {
                label: "In Progress",
                color: STATUS_CHART_COLORS.INPROGRESS,
              },
              NOTSTARTED: {
                label: "Not Started",
                color: STATUS_CHART_COLORS.NOTSTARTED,
              },
              WAITING: {
                label: "Waiting",
                color: STATUS_CHART_COLORS.WAITING,
              },
            }}
            className="min-h-[250px] w-full lg:w-[300px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={sortedStatusStats.map((s) => ({
                  ...s,
                  fill: `var(--color-${s.status})`,
                }))}
                dataKey="count"
                nameKey="status"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-xl font-bold"
                          >
                            {all.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground"
                          >
                            Items
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
      </div>
    </GrainCardContainer>
  );
};

export { ProfileStatusStats };
