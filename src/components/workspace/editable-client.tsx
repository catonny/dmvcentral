
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
import type { Engagement, Client } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

interface EditableClientProps {
  engagement: Engagement;
  currentClient: Client | undefined;
  allClients: Client[];
  onClientChange: (engagementId: string, newClientId: string) => void;
}

export function EditableClient({ engagement, currentClient, allClients, onClientChange }: EditableClientProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSelectClient = (newClientId: string) => {
    if (newClientId && newClientId !== engagement.clientId) {
      onClientChange(engagement.id, newClientId);
    }
    setIsOpen(false);
    setSearchQuery("");
  };
  
  const filteredClients = React.useMemo(() => {
    if (!searchQuery) return allClients;
    return allClients.filter(c => c.Name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allClients, searchQuery]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={isOpen}
          className="w-auto justify-start p-1 h-auto"
        >
          {currentClient ? currentClient.Name : "Select client..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search client..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              {filteredClients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.id}
                  onSelect={(currentValue) => {
                    handleSelectClient(client.id)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      engagement.clientId === client.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {client.Name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
