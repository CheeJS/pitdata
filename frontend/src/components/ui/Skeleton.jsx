import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

/**
 * F1-branded skeleton loader with racing-inspired shimmer effect
 */
export function Skeleton({ className, ...props }) {
    return (
        <div
            className={cn(
                "relative overflow-hidden bg-gray-200 border-2 border-black",
                "before:absolute before:inset-0",
                "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
                "before:animate-[shimmer_1.5s_infinite]",
                className
            )}
            {...props}
        />
    );
}

/**
 * Skeleton card matching the PixelCard style
 */
export function SkeletonCard({ className, children, title }) {
    return (
        <div className={cn(
            "bg-white border-4 border-black shadow-hard overflow-hidden",
            className
        )}>
            {title && (
                <div className="p-4 border-b-4 border-black bg-f1-light">
                    <Skeleton className="h-4 w-32" />
                </div>
            )}
            <div className="p-4">
                {children}
            </div>
        </div>
    );
}

/**
 * Skeleton table rows for standings/results
 */
export function SkeletonTableRow({ columns = 4, className }) {
    return (
        <div className={cn("flex items-center gap-4 py-3 border-b-2 border-gray-100", className)}>
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn(
                        "h-5 rounded-none",
                        i === 0 ? "w-8" : i === 1 ? "flex-1" : "w-16"
                    )}
                />
            ))}
        </div>
    );
}

/**
 * Full dashboard skeleton loader with F1 branding
 */
export function DashboardSkeleton() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            {/* Hero Skeleton */}
            <div className="relative overflow-hidden bg-white border-4 border-black min-h-[320px] shadow-hard">
                {/* Racing stripe effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-f1-light via-white to-f1-light opacity-50" />
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-f1-red/10 to-transparent" />

                <div className="relative p-8 lg:p-10 space-y-6">
                    {/* Badge */}
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-8 w-28 bg-f1-red/20" />
                        <Skeleton className="h-5 w-24" />
                    </div>

                    {/* Title area */}
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-16 w-3/4 lg:w-1/2" />
                        <Skeleton className="h-8 w-48" />
                    </div>

                    {/* Countdown area */}
                    <div className="flex justify-end gap-4 pt-8">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex flex-col items-center gap-2">
                                <Skeleton className="h-16 w-16" />
                                <Skeleton className="h-3 w-10" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Results Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['Qualifying', 'Race', 'Constructors'].map((section, idx) => (
                    <SkeletonCard key={section} title className="h-[400px]">
                        <div className="space-y-1">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <SkeletonTableRow key={i} columns={3} />
                            ))}
                        </div>
                    </SkeletonCard>
                ))}
            </div>
        </motion.div>
    );
}

/**
 * Page transition wrapper
 */
export function PageTransition({ children, className }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export default Skeleton;
