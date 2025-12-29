interface StepProps {
  number: number
  title: string
  children: React.ReactNode
  variant?: 'primary' | 'orange'
}

export default function Step({ number, title, children, variant = 'primary' }: StepProps) {
  const colorClasses = variant === 'orange' 
    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
    : 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'

  return (
    <div className="flex gap-4 mb-8">
      <div className={`flex-shrink-0 w-8 h-8 ${colorClasses} rounded-full flex items-center justify-center font-bold text-sm`}>
        {number}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  )
}
