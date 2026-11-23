import { Slider as BaseSlider } from '@base-ui/react/slider';
import { cn } from '@/lib/utils';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
  className?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onValueChange,
  className,
}: SliderProps) {
  return (
    <BaseSlider.Root
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === 'number') {
          onValueChange(next);
        }
      }}
      className={cn(
        'relative flex w-full touch-none items-center select-none',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <BaseSlider.Control className="flex w-full items-center py-2 cursor-pointer">
        <BaseSlider.Track className="relative h-1.5 w-full grow rounded-full bg-secondary">
          <BaseSlider.Indicator className="h-full rounded-full bg-primary" />
          <BaseSlider.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-xs transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
