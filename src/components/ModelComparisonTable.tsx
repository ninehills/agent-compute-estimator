import { ArrowRight, BarChart3, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDecimal, formatNumber, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ModelEvalResult } from '@/types/calculator';

interface ModelComparisonTableProps {
  results: ModelEvalResult[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
}

export function ModelComparisonTable({
  results,
  selectedModelId,
  onSelectModel,
}: ModelComparisonTableProps) {
  const minCards = Math.min(...results.map((r) => r.totalCards910B3));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <CardTitle>多模型算力横向对比</CardTitle>
          </div>
          <Badge variant="secondary">共 {results.length} 个候选模型</Badge>
        </div>
        <CardDescription>
          相同智能体负载下各模型的实例规模、卡数与服务器需求对比（点击任意行可切换上方详表）
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">模型名称与规格</TableHead>
              <TableHead>单实例配置</TableHead>
              <TableHead className="text-right">单实例输出吞吐</TableHead>
              <TableHead className="text-right">单实例稳态并发</TableHead>
              <TableHead className="text-right">基础 / 最终实例</TableHead>
              <TableHead className="text-right">总卡数</TableHead>
              <TableHead className="text-right">服务器台数</TableHead>
              <TableHead>主导瓶颈 / 水位</TableHead>
              <TableHead className="pr-5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((item) => {
              const isSelected = item.model.id === selectedModelId;
              const isLowestCards = item.totalCards910B3 === minCards;
              return (
                <TableRow
                  key={item.model.id}
                  onClick={() => onSelectModel(item.model.id)}
                  className={cn(
                    'cursor-pointer',
                    isSelected && 'bg-accent/70 hover:bg-accent/80',
                  )}
                >
                  <TableCell className="pl-5">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">
                          {item.model.name}
                        </span>
                        {isLowestCards ? (
                          <Badge variant="success" className="text-[10px] py-0">
                            最省卡
                          </Badge>
                        ) : null}
                        {item.model.isCustom ? (
                          <Badge variant="info" className="text-[10px] py-0">
                            自定义
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {item.model.totalParams}总 / {item.model.activeParams}激活 ·{' '}
                        {item.model.precision}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground">
                      {item.model.cardsPerInstance} 卡/实例
                    </span>
                    <div className="text-[11px] text-muted-foreground">
                      {item.model.instanceSpecLabel}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(item.effectiveInstOutputTps, 0)} tok/s
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatDecimal(item.effectiveInstConc, 1)} 路
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatDecimal(item.baseInstances, 2)} /{' '}
                    <span className="font-semibold text-foreground">
                      {formatDecimal(item.finalInstances, 2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm font-bold text-info-foreground">
                      {formatDecimal(item.totalCards910B3, 1)}
                    </span>
                    <span className="ml-0.5 text-[11px] text-muted-foreground">
                      卡
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm font-bold text-success-foreground">
                      {formatDecimal(item.totalServers8Card, 2)}
                    </span>
                    <span className="ml-0.5 text-[11px] text-muted-foreground">
                      台
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground">
                        {item.bottleneckLabel}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        峰值水位 {formatPercent(item.actualPeakUtil, 1)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        已选中
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectModel(item.model.id);
                        }}
                      >
                        详查
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
