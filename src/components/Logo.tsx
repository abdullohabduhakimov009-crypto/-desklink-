import React from 'react';

interface LogoProps {
  className?: string;
  isDark?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "" }) => {
  return (
    <div className={`inline-flex items-center gap-2 sm:gap-3 group cursor-pointer ${className}`}>
      <div className="relative w-10 h-10 flex items-center justify-center">
        {/* Futuristic Hexagon Icon */}
        <svg viewBox="0 0 100 100" className="w-full h-full transition-transform duration-500 group-hover:rotate-12">
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path 
            d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z" 
            fill="none" 
            stroke="url(#logoGradient)" 
            strokeWidth="8"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_8px_rgba(45,212,191,0.5)]"
          />
          <path 
            d="M35 50 L45 60 L65 40" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="10" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="text-white group-hover:text-brand-teal transition-colors duration-300"
          />
        </svg>
        <div className="absolute inset-0 bg-brand-teal/20 blur-xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
      
      <span className="font-bold text-xl sm:text-2xl tracking-tighter flex items-center">
        <span className="text-white transition-colors duration-300">Desk</span>
        <span className="text-brand-teal">Link</span>
        <div className="w-1.5 h-1.5 bg-brand-teal rounded-full ml-1 mt-3 shadow-[0_0_10px_rgba(45,212,191,0.8)]" />
      </span>
    </div>
  );
};

export default Logo;
