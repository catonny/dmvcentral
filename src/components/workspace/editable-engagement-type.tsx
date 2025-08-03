
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
  CommandCreate,
} from "@/components/ui/command";
import type { Engagement, EngagementType } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Edit } from "lucide-react";

interface EditableEngagementTypeProps {
  engagement: Engagement;
  allEngagementTypes: EngagementType[];
  onEngagementTypeChange: (engagementId: string, newTypeId: string, newTypeName: string) => void;
}

export function EditableEngagementType({ engagement, allEngagementTypes, onEngagementTypeChange }: EditableEngagementTypeProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  
  const currentTypeName = allEngagementTypes.find(et => et.id === engagement.type)?.name || engagement.type;

  const handleSelect = (newValue: string, newName?: string) => {
    onEngagementTypeChange(engagement.id, newValue, newName || newValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  const filteredEngagementTypes = searchQuery
    ? allEngagementTypes.filter(et => et.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allEngagementTypes;
    
  const showCreateOption = searchQuery && !filteredEngagementTypes.some(et => et.name.toLowerCase() === searchQuery.toLowerCase());

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={isOpen}
          className="w-auto justify-start p-1 h-auto font-medium group"
        >
          <span className="truncate max-w-[250px]">{currentTypeName}</span>
          <Edit className="ml-2 h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput
            placeholder="Search or create type..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {filteredEngagementTypes.length === 0 && !showCreateOption && <CommandEmpty>No types found.</CommandEmpty>}
            <CommandGroup>
              {filteredEngagementTypes.map((type) => (
                <CommandItem
                  key={type.id}
                  value={type.id}
                  onSelect={(currentValue) => {
                    const selectedType = allEngagementTypes.find(t => t.id === currentValue);
                    handleSelect(currentValue, selectedType?.name)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      engagement.type === type.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {type.name}
                </CommandItem>
              ))}
            </CommandGroup>
             {showCreateOption && (
                <CommandCreate onSelect={() => handleSelect(searchQuery, searchQuery)}>
                    Create "{searchQuery}"
                </CommandCreate>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
