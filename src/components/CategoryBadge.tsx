import { categoryBadgeClass } from '@/lib/categoryBadge'

interface CategoryBadgeProps {
  category: string
  className?: string
}

export function CategoryBadge({ category, className = '' }: CategoryBadgeProps) {
  return (
    <span className={`badge badge-xs align-middle ${categoryBadgeClass(category)} ${className}`}>
      {category}
    </span>
  )
}
