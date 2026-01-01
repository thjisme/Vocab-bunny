
import React from 'react';

export type MascotMood = 'neutral' | 'happy' | 'excited' | 'confused' | 'sleepy';

interface MascotProps {
  size?: string;
  className?: string;
  mood?: MascotMood;
}

export const Mascot: React.FC<MascotProps> = ({ size = "w-24 h-24", className = "", mood = 'neutral' }) => {
  const getMoodColors = () => {
    switch (mood) {
      case 'happy': return { face: '#FFF', blush: '#FFD1DC', eyeY: 55 };
      case 'excited': return { face: '#FFF', blush: '#FF80AB', eyeY: 52 };
      case 'confused': return { face: '#F5F5F5', blush: '#E0E0E0', eyeY: 55 };
      default: return { face: '#FFF', blush: '#FFD1DC', eyeY: 55 };
    }
  };

  const colors = getMoodColors();

  return (
    <div className={`${size} ${className} relative flex flex-col items-center justify-center`}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg transition-all duration-300">
        {/* Ears */}
        <ellipse cx="35" cy="25" rx="10" ry="25" fill="#FFB7C5" stroke="#4A4A4A" strokeWidth="2" />
        <ellipse cx="65" cy="25" rx="10" ry="25" fill="#FFB7C5" stroke="#4A4A4A" strokeWidth="2" />
        <ellipse cx="35" cy="25" rx="5" ry="15" fill="#FFF" />
        <ellipse cx="65" cy="25" rx="5" ry="15" fill="#FFF" />
        
        {/* Face */}
        <circle cx="50" cy="60" r="30" fill={colors.face} stroke="#4A4A4A" strokeWidth="2" />
        
        {/* Eyes */}
        {mood === 'excited' ? (
           <g fill="none" stroke="#4A4A4A" strokeWidth="2">
             <path d="M35 55 Q40 50 45 55" />
             <path d="M55 55 Q60 50 65 55" />
           </g>
        ) : mood === 'confused' ? (
          <g fill="#4A4A4A">
            <circle cx="40" cy="55" r="2" />
            <circle cx="60" cy="55" r="2" />
            <path d="M48 48 Q50 45 52 48" fill="none" stroke="#4A4A4A" strokeWidth="1" />
          </g>
        ) : (
          <>
            <circle cx="40" cy={colors.eyeY} r="3" fill="#4A4A4A" />
            <circle cx="60" cy={colors.eyeY} r="3" fill="#4A4A4A" />
          </>
        )}
        
        {/* Nose & Mouth */}
        <path 
          d={mood === 'happy' || mood === 'excited' ? "M45 65 Q50 72 55 65" : "M48 65 Q50 68 52 65"} 
          fill="none" 
          stroke={mood === 'excited' ? "#FF4081" : "#FF80AB"} 
          strokeWidth="2" 
          strokeLinecap="round" 
        />
        
        {/* Blush */}
        <circle cx="30" cy="62" r="4" fill={colors.blush} opacity="0.6" />
        <circle cx="70" cy="62" r="4" fill={colors.blush} opacity="0.6" />
      </svg>
      {mood === 'excited' && (
         <div className="absolute -top-2 -right-2 text-2xl animate-bounce">✨</div>
      )}
    </div>
  );
};
