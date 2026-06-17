"use client";

import React, { useState } from "react";

const defaultValue =
  "Hello,\n\nIf the distribution of letters and words is random, the reader will not be distracted from making a neutral judgment on the visual impact and readability of the typefaces or the distribution of text on the page.\n\nThank you";

export default function Editer() {
  const [value, setValue] = useState(defaultValue);

  return (
    <textarea
      className="min-h-[240px] w-full rounded-md border border-gray-200 bg-white p-4 text-sm leading-6 text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

