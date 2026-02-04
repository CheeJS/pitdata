import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Single digit card that animates only when the value changes
 */
const MotionDigit = ({ digit, isLarge }) => (
    <div className={cn(
        "relative overflow-hidden bg-white border-2 border-black shadow-hard flex items-center justify-center",
        isLarge ? "w-8 h-12 lg:w-10 lg:h-14" : "w-6 h-8"
    )}>
        {/* Red accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-f1-red z-20" />

        <AnimatePresence mode="popLayout">
            <motion.div
                key={digit}
                initial={{ y: '-100%' }}
                animate={{ y: '0%' }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                    "absolute inset-0 flex items-center justify-center font-heading text-black font-black z-10 bg-white",
                    isLarge ? "text-2xl lg:text-3xl" : "text-xl"
                )}
            >
                {digit}
            </motion.div>
        </AnimatePresence>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none z-30" style={{
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '4px 4px'
        }} />
    </div>
);

/**
 * Group of digits for a value (e.g. Days, Hours)
 */
const DigitGroup = ({ value, label, isLarge = false, minDigits = 2 }) => {
    const digits = String(value).padStart(minDigits, '0').split('');

    return (
        <div className="flex flex-col items-center">
            <div className="flex gap-0.5">
                {digits.map((d, i) => (
                    <MotionDigit key={i} digit={d} isLarge={isLarge} />
                ))}
            </div>
            <div className={cn(
                "mt-1 bg-black text-white font-heading uppercase tracking-widest px-1",
                isLarge ? "text-xs" : "text-[10px]"
            )}>
                {label}
            </div>
        </div>
    );
};

/**
 * Animated separator
 */
const Separator = ({ isLarge }) => (
    <div className={cn(
        "flex flex-col gap-1 justify-center h-full pt-4",
        isLarge ? "mx-1" : "mx-0.5"
    )}>
        <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className={cn("bg-f1-red rounded-full", isLarge ? "w-1 h-1" : "w-0.5 h-0.5")}
        />
        <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
            className={cn("bg-f1-red rounded-full", isLarge ? "w-1 h-1" : "w-0.5 h-0.5")}
        />
    </div>
);

export default function CountdownTimer({ targetDate, large = false }) {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date().getTime();
            const distance = new Date(targetDate).getTime() - now;

            if (distance < 0) {
                return { days: 0, hours: 0, minutes: 0, seconds: 0 };
            }

            return {
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000)
            };
        };

        // Initial calculation
        setTimeLeft(calculateTime());

        const timer = setInterval(() => {
            setTimeLeft(calculateTime());
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    if (large) {
        return (
            <div className="flex items-start">
                <DigitGroup value={timeLeft.days} label="Days" isLarge />
                <Separator isLarge />
                <DigitGroup value={timeLeft.hours} label="Hrs" isLarge />
                <Separator isLarge />
                <DigitGroup value={timeLeft.minutes} label="Mins" isLarge />
            </div>
        );
    }

    return (
        <div className="flex items-start">
            <DigitGroup value={timeLeft.days} label="Days" />
            <Separator />
            <DigitGroup value={timeLeft.hours} label="Hrs" />
            <Separator />
            <DigitGroup value={timeLeft.minutes} label="Mins" />
            <Separator />
            <DigitGroup value={timeLeft.seconds} label="Secs" />
        </div>
    );
}
