
"use client"

import React, { useState, useEffect } from 'react';
import { Row } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Client } from '@/lib/data';
import { useDebounce } from '@/hooks/use-debounce';

interface EditableCellProps {
  row: Row<Client>;
  accessorKey: keyof Client;
  updateData: (clientId: string, columnId: keyof Client, value: any) => void;
}

export const EditableCell: React.FC<EditableCellProps> = ({ row, accessorKey, updateData }) => {
  const initialValue = row.original[accessorKey];
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebounce(value, 500); // 500ms debounce delay

  // This is now controlled by the presence of an edit button, so we can make this always false.
  const isEditable = false;

  // This effect synchronizes the local state with the prop,
  // preventing the input from being cleared on re-renders.
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    // Only update if the debounced value is different from the initial value
    // and the cell is editable.
    if (isEditable && debouncedValue !== initialValue) {
      updateData(row.original.id, accessorKey, debouncedValue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  if (!isEditable) {
    return <div className="px-3 py-2 text-sm">{String(value) || ''}</div>;
  }

  return (
    <Input
      value={String(value) || ''}
      onChange={onChange}
      className="w-full border-none focus:ring-1 focus:ring-ring"
      disabled={!isEditable}
    />
  );
};
