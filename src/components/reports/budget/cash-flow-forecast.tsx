
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Expense, RecurringEngagement, Engagement } from "@/lib/data";
import { addMonths, format, getMonth, getYear, parseISO, startOfMonth } from "date-fns";

interface CashFlowForecastProps {
    expenses: Expense[];
    recurringEngagements: RecurringEngagement[];
    oneTimeEngagements: Engagement[];
}

interface ForecastRow {
    month: string;
    recurringRevenue: number;
    projectedRevenue: number;
    totalInflow: number;
    budgetedExpenses: number;
    netCashFlow: number;
    cumulativeCashFlow: number;
}

export function CashFlowForecast({ expenses, recurringEngagements, oneTimeEngagements }: CashFlowForecastProps) {
    const forecastData = React.useMemo(() => {
        const monthlyExpenses = expenses.filter(e => e.type === 'Monthly').reduce((sum, e) => sum + e.amount, 0);
        const annualExpenses = expenses.filter(e => e.type === 'Annual').reduce((sum, e) => sum + e.amount, 0);
        const totalMonthlyBudget = monthlyExpenses + (annualExpenses / 12);
        
        const mrr = recurringEngagements.reduce((sum, re) => {
            if (re.recurrence === 'Monthly') return sum + re.fees;
            if (re.recurrence === 'Quarterly') return sum + (re.fees / 3);
            if (re.recurrence === 'Yearly') return sum + (re.fees / 12);
            return sum;
        }, 0);
        
        const forecast: ForecastRow[] = [];
        let cumulativeCashFlow = 0;

        for (let i = 0; i < 12; i++) {
            const forecastMonthDate = addMonths(startOfMonth(new Date()), i);
            const month = getMonth(forecastMonthDate); // 0-11
            const year = getYear(forecastMonthDate);

            // Calculate projected one-time revenue for this month
            // Assumes payment within 30 days of due date. So, if due date is in this month, payment is also this month.
            const projectedRevenue = oneTimeEngagements.reduce((sum, eng) => {
                const dueDate = parseISO(eng.dueDate);
                if (getMonth(dueDate) === month && getYear(dueDate) === year) {
                    return sum + (eng.fees || 0);
                }
                return sum;
            }, 0);
            
            const totalInflow = mrr + projectedRevenue;
            const netCashFlow = totalInflow - totalMonthlyBudget;
            cumulativeCashFlow += netCashFlow;

            forecast.push({
                month: format(forecastMonthDate, 'MMM yyyy'),
                recurringRevenue: mrr,
                projectedRevenue: projectedRevenue,
                totalInflow: totalInflow,
                budgetedExpenses: totalMonthlyBudget,
                netCashFlow: netCashFlow,
                cumulativeCashFlow: cumulativeCashFlow,
            });
        }
        
        return forecast;
    }, [expenses, recurringEngagements, oneTimeEngagements]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>12-Month Cash Flow Forecast</CardTitle>
                <CardDescription>
                    A projection of your cash flow based on recurring revenue, projected one-time work, and budgeted expenses.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead className="text-right">Recurring Revenue</TableHead>
                            <TableHead className="text-right">Projected Revenue</TableHead>
                            <TableHead className="text-right">Total Inflow</TableHead>
                            <TableHead className="text-right">Budgeted Expenses</TableHead>
                            <TableHead className="text-right">Net Cash Flow</TableHead>
                            <TableHead className="text-right">Cumulative</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {forecastData.map((row) => (
                            <TableRow key={row.month}>
                                <TableCell className="font-medium">{row.month}</TableCell>
                                <TableCell className="text-right font-mono">₹{row.recurringRevenue.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-mono">₹{row.projectedRevenue.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-mono font-semibold">₹{row.totalInflow.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-mono text-orange-400">₹{row.budgetedExpenses.toLocaleString()}</TableCell>
                                <TableCell className={cn("text-right font-mono font-bold flex items-center justify-end gap-2", row.netCashFlow >= 0 ? "text-green-400" : "text-red-400")}>
                                     {row.netCashFlow >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                    ₹{Math.abs(row.netCashFlow).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono">{row.cumulativeCashFlow.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
