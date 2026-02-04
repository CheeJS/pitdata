import { cn } from '../lib/utils';

// Map driver abbreviations to their team sprite files (2026 Grid)
const DRIVER_TEAM_MAP = {
    // Red Bull
    'VER': 'red_bull',
    'HAD': 'red_bull',
    // Ferrari
    'LEC': 'ferrari',
    'HAM': 'ferrari',
    // McLaren
    'NOR': 'mclaren',
    'PIA': 'mclaren',
    // Mercedes
    'RUS': 'mercedes',
    'ANT': 'mercedes',
    // Aston Martin
    'ALO': 'aston_martin',
    'STR': 'aston_martin',
    // Alpine
    'GAS': 'alpine',
    'COL': 'alpine', // Colapinto
    'DOO': 'alpine', // Doohan (Legacy check)
    // Williams
    'ALB': 'williams',
    'SAI': 'williams',
    // Haas
    'OCO': 'haas',
    'BEA': 'haas',
    // Audi (formerly Sauber)
    'HUL': 'audi',
    'BOR': 'audi',
    // Racing Bulls
    'LAW': 'racing_bulls',
    'LIN': 'racing_bulls', // Lindblad
    // Cadillac (New)
    'PER': 'cadillac',
    'BOT': 'cadillac',
};

// Fallback for unknown drivers
const FALLBACK_TEAM = 'red_bull';

/**
 * DriverSprite - Displays a pixel art driver sprite with optional animations
 * 
 * @param {string} driver - Driver abbreviation (VER, NOR, etc.)
 * @param {string} teamId - Direct team ID (e.g. 'ferrari') to bypass driver mapping
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {string} variant - 'idle' | 'win' | 'sad' | 'thinking'
 * @param {boolean} flip - Mirror the sprite horizontally
 * @param {string} className - Additional CSS classes
 */
export default function DriverSprite({
    driver,
    teamId,
    size = 'md',
    variant = 'idle',
    flip = false,
    className = ''
}) {
    // Determine team: either direct teamId or mapped from driver code
    const team = teamId || DRIVER_TEAM_MAP[driver?.toUpperCase()] || FALLBACK_TEAM;

    // Construct path based on variant
    // Folder structure: /assets/drivers/2026/[variant]/[team].gif
    // idle -> /assets/drivers/2026/idle/[team].gif
    // win -> /assets/drivers/2026/win/[team].gif

    // Legacy support/Fallback logic could be handled here if needed, 
    // but we are moving to strict structure.

    let folder = 'idle';
    if (variant === 'win') folder = 'win';
    if (variant === 'sad') folder = 'sad'; // Future proofing

    // Note: The file names in the new structure are likely just [team].gif inside the folder
    // e.g. /assets/drivers/2026/idle/red_bull.gif

    const spritePath = `/assets/drivers/2026/${folder}/${team}.gif`;

    const sizeClasses = {
        sm: 'w-8 h-10',    // Compact
        md: 'w-16 h-24',   // Standard
        lg: 'w-24 h-36',   // Large
        xl: 'w-32 h-48',   // Extra Large
    };

    return (
        <img
            src={spritePath}
            alt={`${driver || team} sprite`}
            className={cn(
                sizeClasses[size] || sizeClasses.md,
                "object-contain pixelated",
                flip && "scale-x-[-1]",
                "transition-transform",
                className
            )}
            onError={(e) => {
                // Fallback to Red Bull sprite if team sprite doesn't exist
                if (e.target.src.indexOf('red_bull.gif') === -1) {
                    e.target.src = `/assets/drivers/2026/idle/red_bull.gif`;
                }
            }}
        />
    );
}
