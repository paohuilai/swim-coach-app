import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

interface PlanItemProps {
  id: string;
  content: string;
  load: number;
  onRemove: (id: string) => void;
}

export function DraggablePlanItem(props: PlanItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm flex items-center gap-3 group hover:border-brand-blue transition-colors">
      <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-gray-900">{props.content}</div>
        <div className="text-xs text-gray-500">负荷系数: {props.load}</div>
      </div>
      <button onClick={() => props.onRemove(props.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
