
"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Engagement, Employee } from "@/lib/data"
import { Loader2 } from "lucide-react"

interface WorkloadDistributionProps {
  engagements: Engagement[]
  employees: Employee[]
}

export function WorkloadDistribution({ engagements, employees }: WorkloadDistributionProps) {
  const chartData = React.useMemo(() => {
    if (!employees.length || !engagements.length) {
      return []
    }

    const employeeWorkload = employees.map(member => {
      const pendingCount = engagements.filter(
        e => e.assignedTo.includes(member.id) && e.status === "Pending"
      ).length
      return {
        name: member.name.split(" ")[0], // Use first name for brevity
        pending: pendingCount,
      }
    })

    const unassignedCount = engagements.filter(
      e => !e.assignedTo || e.assignedTo.length === 0
    ).length

    if (unassignedCount > 0) {
      employeeWorkload.push({
        name: "Unassigned",
        pending: unassignedCount,
      })
    }

    // Filter out employees with no pending tasks, but always show "Unassigned" if it has tasks
    return employeeWorkload.filter(item => item.pending > 0);
  }, [engagements, employees])

  if (!employees.length || !engagements.length) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Workload Distribution</CardTitle>
                <CardDescription>Pending and unassigned engagements.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-72">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workload Distribution</CardTitle>
        <CardDescription>
          A look at pending and unassigned engagements across the team.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{
            pending: {
                label: "Pending",
                color: "hsl(var(--chart-2))",
            },
        }} className="h-72">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip
              content={<ChartTooltipContent />}
              cursor={{ fill: 'hsl(var(--muted))' }}
            />
            <Bar dataKey="pending" fill="var(--color-pending)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
