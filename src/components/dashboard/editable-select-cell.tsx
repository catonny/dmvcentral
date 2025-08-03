
"use client"

import React from 'react';
import { Row } from '@tanstack/react-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Client } from '@/lib/data';

interface EditableSelectCellProps {
  row: Row<Client>;
  accessorKey: keyof Client;
  options: string[];
  updateData: (clientId: string, columnId: keyof Client, value: any) => void;
  isEmployeeColumn?: boolean;
}

export const EditableSelectCell: React.FC<EditableSelectCellProps> = ({
  row,
  accessorKey,
  options,
  updateData,
  isEmployeeColumn = false,
}) => {
  const initialValue = row.original[accessorKey] as string;

  // This is now controlled by the presence of an edit button, so we can make this always false.
  const isEditable = false; 

  const handleSelectChange = (newValue: string) => {
    if (isEditable) {
      updateData(row.original.id, accessorKey, newValue);
    }
  };
  
  if (!isEditable) {
      return <div className="px-3 py-2 text-sm">{initialValue || ''}</div>
  }

  return (
    <Select value={initialValue || ''} onValueChange={handleSelectChange} disabled={!isEditable}>
      <SelectTrigger className="w-full border-none focus:ring-1 focus:ring-ring disabled:opacity-100 disabled:cursor-default">
        <SelectValue placeholder={`Select ${accessorKey}`} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
