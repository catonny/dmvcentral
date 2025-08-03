
"use client";

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';

export function ClockWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  const formattedDate = format(time, 'eeee, d MMM');
  const formattedTime = format(time, 'HH:mm:ss');

  return (
    <div className="flex items-center gap-6 text-white bg-white/10 px-4 py-2 rounded-lg">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        <span className="font-medium text-sm">{formattedDate}</span>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5" />
        <span className="font-mono text-sm tracking-wider">{formattedTime}</span>
      </div>
    </div>
  );
}

