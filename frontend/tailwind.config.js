/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			colors: {
				f1: {
					red: '#FF0000', // Pure Red
					dark: '#000000', // Pure Black
					carbon: '#222222', // Dark Gray
					gray: '#888888', // Med Gray
					light: '#EEEDEB', // Warm Grey - easier on the eyes
					paper: '#F9F9F7' // Warm White - for cards
				},
				team: {
					ferrari: '#FF2800',
					mclaren: '#FF8700',
					redbull: '#0600EF',
					mercedes: '#00D2BE',
					aston: '#006F62',
					alpine: '#0090FF',
					williams: '#005AFF',
					haas: '#FFFFFF',
					sauber: '#52E252',
					rb: '#1634CB'
				},
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				}
			},
			fontFamily: {
				heading: [
					'"Press Start 2P"',
					'cursive'
				],
				body: [
					'"VT323"',
					'monospace'
				]
			},
			borderRadius: {
				lg: '0px',
				md: '0px',
				sm: '0px',
				DEFAULT: '0px'
			},
			boxShadow: {
				'hard': '4px 4px 0px 0px rgba(0,0,0,1)',
				'hard-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
				'hard-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
}
