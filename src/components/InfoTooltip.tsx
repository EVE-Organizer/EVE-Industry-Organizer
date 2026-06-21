interface InfoTooltipProps {
  text: string
  className?: string
}

export function InfoTooltip({ text, className = '' }: InfoTooltipProps) {
  return (
    <span
      className={`tooltip tooltip-right inline-flex shrink-0 items-center self-center before:max-w-xs before:text-left before:whitespace-normal before:content-[attr(data-tip)] ${className}`}
      data-tip={text}
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-current opacity-50 hover:opacity-100 cursor-help text-[10px] font-bold leading-none"
        aria-label={text}
        tabIndex={0}
      >
        i
      </span>
    </span>
  )
}
