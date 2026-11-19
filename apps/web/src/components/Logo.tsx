interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export function Logo({ className = '', size = 'md', showText = true }: LogoProps) {
  const sizeMap = {
    sm: { icon: 'h-7 w-7', text: 'text-xs', sub: 'text-[9px]' },
    md: { icon: 'h-8 w-8', text: 'text-sm', sub: 'text-[10px]' },
    lg: { icon: 'h-10 w-10', text: 'text-base', sub: 'text-xs' },
    xl: { icon: 'h-14 w-14', text: 'text-xl', sub: 'text-sm' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* SVG Vector Logo Icon */}
      <div className={`relative ${currentSize.icon} shrink-0 group cursor-pointer`}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full rounded-xl shadow-md shadow-orange-500/20 transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            <linearGradient id="logoOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <linearGradient id="pulseAccent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#ffedd5" />
            </linearGradient>
          </defs>

          {/* Badge Background */}
          <rect width="64" height="64" rx="16" fill="url(#logoOrangeGrad)" />
          <rect x="2" y="2" width="60" height="60" rx="14" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />

          {/* Precision Industrial Gear Motif (Background) */}
          <path
            fill="#ffffff"
            opacity="0.3"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M30 13h4v3.2a14.5 14.5 0 0 1 3.9 1.6l2.3-2.3 2.8 2.8-2.3 2.3a14.5 14.5 0 0 1 1.6 3.9H46v4h-3.7a14.5 14.5 0 0 1-1.6 3.9l2.3 2.3-2.8 2.8-2.3-2.3a14.5 14.5 0 0 1-3.9 1.6V39h-4v-3.2a14.5 14.5 0 0 1-3.9-1.6l-2.3 2.3-2.8-2.8 2.3-2.3a14.5 14.5 0 0 1-1.6-3.9H18v-4h3.7a14.5 14.5 0 0 1 1.6-3.9l-2.3-2.3 2.8-2.8 2.3 2.3a14.5 14.5 0 0 1 3.9-1.6V13zm2 6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z"
            transform="translate(0, 5)"
          />

          {/* Bold Monogram "M" & Reliability Uptime Pulse */}
          <path
            d="M16 46 L25 28 L32 38 L39 20 L48 46"
            stroke="url(#pulseAccent)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Center Apex Reliability Signal Node */}
          <circle cx="39" cy="20" r="3.2" fill="#ffffff" />
          <circle cx="39" cy="20" r="1.5" fill="#ea580c" />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col text-left">
          <span className={`${currentSize.text} font-black tracking-tight text-stone-900 leading-tight`}>
            Maintenance <span className="text-orange-600">MCS</span>
          </span>
          <span className={`${currentSize.sub} font-bold text-stone-400 tracking-wider uppercase`}>
            Plant Reliability System
          </span>
        </div>
      )}
    </div>
  );
}
