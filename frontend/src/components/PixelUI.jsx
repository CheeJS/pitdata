import React from 'react';

export const PixelCard = ({ children, className = '', title, noShadow = false }) => {
    return (
        <div className={`bg-white border-4 border-black p-4 relative ${!noShadow ? 'shadow-hard' : ''} ${className}`}>
            {/* Corner Bolts */}
            <div className="absolute top-1 left-1 w-2 h-2 bg-gray-300 border border-black" />
            <div className="absolute top-1 right-1 w-2 h-2 bg-gray-300 border border-black" />
            <div className="absolute bottom-1 left-1 w-2 h-2 bg-gray-300 border border-black" />
            <div className="absolute bottom-1 right-1 w-2 h-2 bg-gray-300 border border-black" />

            {title && (
                <div className="border-b-4 border-black pb-2 mb-4 -mx-4 px-4 bg-f1-light flex justify-between items-center">
                    <h3 className="text-xl font-heading uppercase text-black">{title}</h3>
                    {/* Decorative lines */}
                    <div className="flex gap-1">
                        <div className="w-2 h-4 bg-black/10 skew-x-12"></div>
                        <div className="w-2 h-4 bg-black/10 skew-x-12"></div>
                        <div className="w-2 h-4 bg-black/10 skew-x-12"></div>
                    </div>
                </div>
            )}
            {children}
        </div>
    );
};

export const PixelButton = ({ children, onClick, variant = 'primary', className = '', ...props }) => {
    const baseStyles = "font-heading py-2 px-4 border-4 border-black transition-transform active:translate-y-1 active:shadow-none shadow-hard outline-none";

    const variants = {
        primary: "bg-f1-red text-white hover:bg-red-600",
        secondary: "bg-f1-light text-black hover:bg-gray-200",
        outline: "bg-transparent text-black hover:bg-gray-100",
        danger: "bg-black text-white hover:bg-gray-800"
    };

    return (
        <button
            onClick={onClick}
            className={`${baseStyles} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

export const PixelBadge = ({ children, color = 'bg-black', className = '' }) => {
    return (
        <span className={`${color} text-white px-2 py-0.5 border-2 border-black font-body text-lg ${className}`}>
            {children}
        </span>
    );
}

export const PixelInput = ({ className = '', ...props }) => {
    return (
        <input
            className={`border-4 border-black p-2 font-body text-xl shadow-hard-sm focus:outline-none focus:shadow-hard transition-all ${className}`}
            {...props}
        />
    )
}
