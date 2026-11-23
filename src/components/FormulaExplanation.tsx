import { BookOpenCheck } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { FormulaStep, ModelSpec } from '@/types/calculator';

interface FormulaExplanationProps {
  model: ModelSpec;
  steps: FormulaStep[];
}

export function FormulaExplanation({ model, steps }: FormulaExplanationProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-info" />
            <CardTitle>计算过程详细解释（6 步白盒公式推导）</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono text-[11px]">
            当前推导模型：{model.name}（{model.cardsPerInstance}卡/实例）
          </Badge>
        </div>
        <CardDescription>
          以下每一步均实时带入左侧业务参数与当前模型的 910B3 压测基准，所有中间值均可直接审计复核
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion
          multiple
          defaultValue={steps.map((s) => String(s.stepNumber))}
          className="divide-y divide-border/70"
        >
          {steps.map((step) => (
            <AccordionItem key={step.stepNumber} value={String(step.stepNumber)}>
              <AccordionTrigger>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
                      {step.stepNumber}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">
                        {step.title}
                      </span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {step.subtitle}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      {step.resultLabel}：
                    </span>
                    <Badge variant="secondary" className="font-mono tabular-nums">
                      {step.resultValue}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionPanel>
                <div className="ml-7.5 flex flex-col gap-2">
                  <div className="rounded-lg border border-border/80 bg-muted/50 px-3 py-2 font-mono text-[11px] text-foreground overflow-x-auto">
                    {step.formula}
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-foreground/90 leading-relaxed tabular-nums">
                    <span className="mr-1.5 font-medium text-muted-foreground">
                      当前参数代入：
                    </span>
                    {step.substitution}
                  </div>
                  {step.note ? (
                    <p className="text-[11px] text-success-foreground">
                      {step.note}
                    </p>
                  ) : null}
                </div>
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
