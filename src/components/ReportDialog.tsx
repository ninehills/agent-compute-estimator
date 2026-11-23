import { useState } from 'react';
import { Check, Code2, Copy, Download, Eye, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadMarkdownReport } from '@/lib/report';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportContent: string;
  modelName: string;
  workloadCount: number;
}

export function ReportDialog({
  open,
  onOpenChange,
  reportContent,
  modelName,
  workloadCount,
}: ReportDialogProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');

  const handleCopy = () => {
    if (!navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(reportContent).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    downloadMarkdownReport(reportContent, modelName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(95vw,960px)] max-h-[88vh] flex flex-col gap-4 overflow-hidden">
        <div className="pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-info" />
            <DialogTitle>智能体算力需求正式评估报告</DialogTitle>
            <Badge variant="secondary">{modelName}</Badge>
            <Badge variant="outline">{workloadCount} 个场景汇总</Badge>
          </div>
          <DialogDescription>
            包含执行摘要、业务流量表、6 步白盒公式推导、工程部署建议及选定模型压测结果附录，可直接复制到方案文档或下载为 Markdown 文件
          </DialogDescription>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/60 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              排版预览
            </button>
            <button
              type="button"
              onClick={() => setViewMode('source')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'source'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              Markdown 源码
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? '已复制全文' : '复制 Markdown 报告'}
            </Button>
            <Button variant="default" size="sm" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
              下载 .md 报告
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-background p-5 sm:p-6">
          {viewMode === 'preview' ? (
            <article className="text-xs leading-relaxed text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-3 text-lg font-bold tracking-tight text-foreground">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mt-5 mb-2.5 border-b border-border/80 pb-1.5 text-sm font-semibold text-foreground">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mt-3.5 mb-1.5 text-xs font-semibold text-foreground">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="my-2 text-xs leading-6 text-foreground/90">
                      {children}
                    </p>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="my-3 rounded-lg border-l-3 border-info bg-muted/45 px-3.5 py-2.5 text-xs text-muted-foreground [&>p]:my-0.5">
                      {children}
                    </blockquote>
                  ),
                  hr: () => <hr className="my-4 border-border/80" />,
                  ul: ({ children }) => (
                    <ul className="my-2 list-disc space-y-1 pl-5 text-xs leading-6 text-foreground/90">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-2 list-decimal space-y-1.5 pl-5 text-xs leading-6 text-foreground/90">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="pl-0.5">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">
                      {children}
                    </strong>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                      {children}
                    </code>
                  ),
                  table: ({ children }) => (
                    <div className="my-3 w-full overflow-x-auto rounded-lg border border-border">
                      <table className="w-full border-collapse text-left text-xs tabular-nums">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/60 text-[11px] font-medium text-muted-foreground">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="divide-y divide-border/70">
                      {children}
                    </tbody>
                  ),
                  tr: ({ children }) => (
                    <tr className="transition-colors hover:bg-muted/30">
                      {children}
                    </tr>
                  ),
                  th: ({ children }) => (
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 text-foreground/90">{children}</td>
                  ),
                }}
              >
                {reportContent}
              </ReactMarkdown>
            </article>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
              {reportContent}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
