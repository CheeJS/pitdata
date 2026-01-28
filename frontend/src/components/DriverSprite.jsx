import { cn } from '../lib/utils';

// Map driver abbreviations to their team sprite files
const DRIVER_TEAM_MAP = {
    // Red Bull
    'VER': 'red_bull',
    'TSU': 'red_bull',
    // McLaren
    'NOR': 'mclaren',
    'PIA': 'mclaren',
    // Ferrari
    'LEC': 'ferrari',
    'HAM': 'ferrari',
    // Mercedes
    'RUS': 'mercedes',
    'ANT': 'mercedes',
    // Aston Martin
    'ALO': 'aston_martin',
    'STR': 'aston_martin',
    // Alpine
    'GAS': 'alpine',
    'DOO': 'alpine',
    // Williams
    'ALB': 'williams',
    'SAI': 'williams',
    // Haas
    'BEA': 'haas',
    'OCO': 'haas',
    // Sauber/Kick
    'HUL': 'sauber',
    'BOR': 'sauber',
    // Racing Bulls
    'LAW': 'racing_bulls',
    'HAD': 'racing_bulls',
};

// Fallback for unknown drivers
const FALLBACK_TEAM = 'red_bull';

/**
 * DriverSprite - Displays a pixel art driver sprite with optional animations
 * 
 * @param {string} driver - Driver abbreviation (VER, NOR, etc.)
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} flip - Mirror the sprite horizontally
 * @param {string} className - Additional CSS classes
 */
export default function DriverSprite({
    driver,
    size = 'md',
    flip = false,
    className = ''
}) {
    const team = DRIVER_TEAM_MAP[driver?.toUpperCase()] || FALLBACK_TEAM;
    const spritePath = `/assets/drivers/${team}_idle_breathing.gif`;

    const sizeClasses = {
        sm: 'w-8 h-10',    // Compact
        md: 'w-16 h-24',   // Standard (was 12x16)
        lg: 'w-24 h-36',   // Large (was 16x20)
        xl: 'w-32 h-48',   // Extra Large (was 20x28)
    };

    return (
        <img
            src={spritePath}
            alt={`${driver} driver sprite`}
            className={cn(
                sizeClasses[size] || sizeClasses.md,
                "object-contain image-rendering-pixelated",
                flip && "scale-x-[-1]",
                "transition-transform hover:scale-110",
                className
            )}
            style={{ imageRendering: 'pixelated' }}
            onError={(e) => {
                // Fallback to Red Bull sprite if team sprite doesn't exist
                e.target.src = `/assets/drivers/${FALLBACK_TEAM}_idle_breathing.gif`;
            }}
        />
    );
}
