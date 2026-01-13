import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { SchemaRenderer } from "@object-ui/react"
import React from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function renderChildren(children: any): React.ReactNode {
  if (!children) return null;
  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <SchemaRenderer key={index} schema={child} />
    ));
  }
  return <SchemaRenderer schema={children} />;
}

