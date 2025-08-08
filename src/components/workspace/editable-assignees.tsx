
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Engagement, Employee } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";

interface EditableAssigneesProps {
  engagement: Engagement;
  allEmployees: Employee[];
  onAssigneesChange: (engagementId: string, newAssignees: string[]) => void;
}

export function EditableAssignees({ engagement, allEmployees, onAssigneesChange }: EditableAssigneesProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const handleToggle = (employeeId: string) => {
    const newAssignees = engagement.assignedTo.includes(employeeId)
      ? engagement.assignedTo.filter(id => id !== employeeId)
      : [...engagement.assignedTo, employeeId];
      
    onAssigneesChange(engagement.id, newAssignees);
  };

  const employeeMap = React.useMemo(() => new Map(allEmployees.map(e => [e.id, e])), [allEmployees]);
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={isOpen}
          className="w-auto justify-start p-1 h-auto -space-x-2 hover:bg-transparent"
        >
            <TooltipProvider>
                {engagement.assignedTo.map(id => {
                    const employee = employeeMap.get(id);
                    if (!employee) return null;
                    return (
                        <Tooltip key={id}>
                            <TooltipTrigger asChild>
                                 <Avatar className="h-8 w-8 border-2 border-background">
                                    <AvatarImage src={employee.avatar} alt={employee.name} />
                                    <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{employee.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
                {engagement.assignedTo.length === 0 && <span className="text-sm text-muted-foreground px-2">Unassigned</span>}
            </TooltipProvider>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search employees..." 
          />
          <CommandList>
            <CommandEmpty>No employees found.</CommandEmpty>
            <CommandGroup>
              {allEmployees.map((employee) => (
                <CommandItem
                  key={employee.id}
                  value={employee.name}
                  onSelect={() => handleToggle(employee.id)}
                >
                  <Checkbox checked={engagement.assignedTo.includes(employee.id)} className="mr-2"/>
                  {employee.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
