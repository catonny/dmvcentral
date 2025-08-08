
"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectWithCreateProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyResultText: string;
  options: { value: string; label: string }[];
  onCreateNew: (value: string) => void;
}

export function SearchableSelectWithCreate({
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyResultText,
  options,
  onCreateNew,
}: SearchableSelectWithCreateProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredOptions = searchQuery
    ? options.filter(option => option.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const showCreateOption = searchQuery && !filteredOptions.some(opt => opt.label.toLowerCase() === searchQuery.toLowerCase());
  
  const selectedLabel = options.find(option => option.value === value)?.label;
  
  const handleCreate = () => {
    onCreateNew(searchQuery);
    // Maybe don't close popover to allow user to see new item?
    // For now, we will close it. User can re-open.
    setIsOpen(false);
    setSearchQuery("");
  };


  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between font-normal"
        >
          {selectedLabel || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
                <div className="p-4 text-sm text-center">
                    {emptyResultText} <br/>
                    <Button variant="link" onClick={handleCreate} className="h-auto p-1 mt-1">
                        <PlusCircle className="mr-2" />
                        Create "{searchQuery}"
                    </Button>
                </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")}
                  />
                  {option.label}
                </CommandItem>
              ))}
              {showCreateOption && (
                 <CommandItem
                    onSelect={handleCreate}
                    className="cursor-pointer"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create "{searchQuery}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
