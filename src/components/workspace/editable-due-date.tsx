
"use client";

import * as React from "react";
import { format, parseISO, isPast, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Engagement } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";

interface EditableDueDateProps {
  engagement: Engagement;
  onDueDateChange: (engagementId: string, newDueDate: Date) => void;
}

export function EditableDueDate({ engagement, onDueDateChange }: EditableDueDateProps) {
  const [dateString, setDateString] = React.useState<string>("");
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    try {
        if(engagement.dueDate) {
            setDateString(format(new Date(engagement.dueDate), 'dd/MM/yyyy'));
        }
    } catch {
        setDateString("");
    }
  }, [engagement.dueDate]);

  const handleSelectDate = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onDueDateChange(engagement.id, selectedDate);
      setIsOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     let value = e.target.value.replace(/[^0-9]/g, '');
     if (value.length > 2) {
         value = `${value.substring(0, 2)}/${value.substring(2)}`;
     }
     if (value.length > 5) {
        value = `${value.substring(0, 5)}/${value.substring(5, 9)}`;
     }
     setDateString(value);

     if(value.length === 10) {
         const parsedDate = parse(value, 'dd/MM/yyyy', new Date());
         if(isValid(parsedDate)) {
             onDueDateChange(engagement.id, parsedDate);
         }
     }
  };
  
  const isOverdue = isPast(new Date(engagement.dueDate)) && engagement.status !== 'Completed';

  return (
      <div className="flex items-center gap-2">
         <Input 
            value={dateString}
            onChange={handleInputChange}
            placeholder="dd/MM/yyyy"
            className={cn(
                "w-[120px] h-8",
                isOverdue ? "text-red-500 border-red-500" : ""
            )}
         />
        <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
            <Button
            variant={"outline"}
            size="icon"
            className={cn(
                "h-8 w-8",
                isOverdue ? "text-red-500 border-red-500 hover:text-red-600" : ""
            )}
            >
            <CalendarIcon className="h-4 w-4" />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
            <Calendar
            mode="single"
            selected={engagement.dueDate ? new Date(engagement.dueDate) : undefined}
            onSelect={handleSelectDate}
            initialFocus
            captionLayout="dropdown-buttons"
            fromYear={new Date().getFullYear() - 10}
            toYear={new Date().getFullYear() + 10}
            />
        </PopoverContent>
        </Popover>
    </div>
  );
}

    