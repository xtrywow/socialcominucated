import React from 'react';
import {
  Briefcase,
  Eye,
  FileChartColumn,
  Megaphone,
  MessagesSquare,
  MonitorSmartphone,
  Network,
  PenTool,
  ScanSearch,
  Search,
  Share2,
  Sparkles,
  UserSearch,
  type LucideIcon,
} from 'lucide-react';
import {colors} from '../theme';

const icons: Record<string, LucideIcon> = {
  Briefcase,
  Eye,
  FileChartColumn,
  Megaphone,
  MessagesSquare,
  MonitorSmartphone,
  Network,
  PenTool,
  ScanSearch,
  Search,
  Share2,
  Sparkles,
  UserSearch,
};

export const Icon: React.FC<{name: string; size: number; color?: string}> = ({name, size, color = colors.gold500}) => {
  const C = icons[name] ?? Sparkles;
  return <C size={size} color={color} strokeWidth={1.6} />;
};
