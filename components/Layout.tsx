
import React from 'react';
import { View } from '../types';
import { Mascot } from './Mascot';
import { Sun, Moon, LogOut, LayoutGrid, Brain, BarChart3, Star, Mic } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  onViewChange: (view: View) => void;
  onLogout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, onLogout, isDarkMode, toggleDarkMode }) => {
  return (
    <div className={`min-h-screen pb-24 transition-colors duration-300 ${isDarkMode ? 'bg-[#1A1A2E] text-white' : 'bg-[#FFF0F5] text-gray-800'}`}>
      <header className="p-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => onViewChange('manage')}>
          <Mascot size="w-12 h-12" />
          <h1 className={`text-2xl font-bold tracking-tight transition-all ${isDarkMode ? 'text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'text-gray-800'}`}>
            VocabBunny
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleDarkMode}
            className={`p-2 rounded-full ${isDarkMode ? 'bg-[#16213E] border border-white/20' : 'bg-white shadow-sm'} transition-all hover:scale-110`}
          >
            {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-indigo-400" />}
          </button>
          {activeView !== 'login' && activeView !== 'register' && (
            <button 
              onClick={onLogout}
              className={`p-2 rounded-full ${isDarkMode ? 'bg-[#16213E] border border-white/20' : 'bg-white shadow-sm'} transition-all hover:scale-110`}
            >
              <LogOut size={20} className="text-red-400" />
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-4xl pt-4">
        {children}
      </main>

      {activeView !== 'login' && activeView !== 'register' && (
        <nav className={`fixed bottom-0 left-0 right-0 p-4 z-40 ${isDarkMode ? 'bg-[#1A1A2E]/90' : 'bg-[#FFF0F5]/90'} backdrop-blur-md`}>
          <div className={`max-w-xl mx-auto flex justify-between p-2 rounded-3xl ${isDarkMode ? 'bg-[#16213E] border border-white/10' : 'bg-white'} shadow-2xl`}>
            <button 
              onClick={() => onViewChange('manage')}
              className={`flex flex-col items-center gap-1 flex-1 p-2 transition-colors ${activeView === 'manage' ? 'text-pink-500' : 'text-gray-400 hover:text-pink-300'}`}
            >
              <LayoutGrid size={22} />
              <span className="text-[9px] font-bold uppercase tracking-wider">List</span>
            </button>
            <button 
              onClick={() => onViewChange('starred')}
              className={`flex flex-col items-center gap-1 flex-1 p-2 transition-colors ${activeView === 'starred' ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-300'}`}
            >
              <Star size={22} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Stars</span>
            </button>
            <button 
              onClick={() => onViewChange('speaking')}
              className={`flex flex-col items-center gap-1 flex-1 p-2 transition-colors ${activeView === 'speaking' ? 'text-cyan-400' : 'text-gray-400 hover:text-cyan-300'}`}
            >
              <Mic size={22} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Speak</span>
            </button>
            <button 
              onClick={() => onViewChange('quiz')}
              className={`flex flex-col items-center gap-1 flex-1 p-2 transition-colors ${activeView === 'quiz' ? 'text-pink-500' : 'text-gray-400 hover:text-pink-300'}`}
            >
              <Brain size={22} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Quiz</span>
            </button>
            <button 
              onClick={() => onViewChange('stats')}
              className={`flex flex-col items-center gap-1 flex-1 p-2 transition-colors ${activeView === 'stats' ? 'text-indigo-400' : 'text-gray-400 hover:text-indigo-300'}`}
            >
              <BarChart3 size={22} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Stats</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
