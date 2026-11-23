import { Cpu, FileText, Moon, RotateCcw, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderBarProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenReport: () => void;
  onResetAll: () => void;
}

export function HeaderBar({
  isDark,
  onToggleTheme,
  onOpenReport,
  onResetAll,
}: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-primary text-primary-foreground shadow-xs">
            <Cpu className="h-4.5 w-4.5" />
          </div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            智能体算力需求评估计算器
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onOpenReport}>
            <FileText className="h-3.5 w-3.5" />
            生成评估报告
          </Button>
          <Button variant="outline" size="sm" onClick={onResetAll}>
            <RotateCcw className="h-3.5 w-3.5" />
            恢复默认
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            aria-label="切换明暗主题"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
