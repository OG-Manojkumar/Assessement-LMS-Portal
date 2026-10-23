"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => setIsExpanded(!isExpanded);

  return (
    <>
      {/* Mobile Top Navbar with Hamburger */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 shadow-lg">
        <Link href="/trainer" className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-500/30">
            BT
          </div>
          <div>
            <span className="font-extrabold text-white text-sm tracking-tight">Besant Tech</span>
            <span className="text-[10px] block text-indigo-400 font-bold uppercase tracking-wider">Trainer Portal</span>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          aria-label="Toggle Navigation"
        >
          {mobileOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity"
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <div className={`md:hidden fixed inset-y-0 left-0 w-72 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-200 z-50 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-indigo-500/40">
              BT
            </div>
            <div>
              <div className="font-black text-white text-base bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                Besant Tech
              </div>
              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Exam Management</div>
            </div>
          </div>
          <button 
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem 
            href="/trainer" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} 
            label="Dashboard" 
            isExpanded={true} 
            isActive={pathname === '/trainer'}
            onClick={() => setMobileOpen(false)}
            accentColor="from-blue-600 to-indigo-600"
          />
          <NavItem 
            href="/trainer/question-bank" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>} 
            label="Question Bank" 
            isExpanded={true} 
            isActive={pathname.includes('/question-bank')}
            onClick={() => setMobileOpen(false)}
            accentColor="from-emerald-600 to-teal-600"
          />
          <NavItem 
            href="/trainer/assessments" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} 
            label="Assessments" 
            isExpanded={true} 
            isActive={pathname.includes('/assessments')}
            onClick={() => setMobileOpen(false)}
            accentColor="from-purple-600 to-indigo-600"
          />
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow">
            TR
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100">Trainer Portal</div>
            <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Live Session
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside 
        className={`hidden md:flex ${isExpanded ? 'w-64' : 'w-20'} bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex-col transition-all duration-300 relative z-20 text-slate-300 shadow-2xl border-r border-slate-800/80`}
      >
        <div className={`p-5 border-b border-slate-800/80 flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} h-24`}>
          {isExpanded && (
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex-shrink-0 flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-500/30">
                BT
              </div>
              <div className="truncate">
                <h1 className="text-base font-black text-white leading-tight tracking-tight bg-gradient-to-r from-blue-400 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
                  Besant Tech
                </h1>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
                  Mock Exams
                </span>
              </div>
            </div>
          )}
          <button 
            onClick={toggleSidebar} 
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-all focus:outline-none hover:scale-105 active:scale-95"
            title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isExpanded ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 mt-3">
          <NavItem 
            href="/trainer" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} 
            label="Dashboard" 
            isExpanded={isExpanded} 
            isActive={pathname === '/trainer'}
            accentColor="from-blue-600 via-indigo-600 to-indigo-700"
          />
          <NavItem 
            href="/trainer/question-bank" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>} 
            label="Question Bank" 
            isExpanded={isExpanded} 
            isActive={pathname.includes('/question-bank')}
            accentColor="from-emerald-600 to-teal-600"
          />
          <NavItem 
            href="/trainer/assessments" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} 
            label="Assessments" 
            isExpanded={isExpanded} 
            isActive={pathname.includes('/assessments')}
            accentColor="from-purple-600 via-indigo-600 to-indigo-700"
          />
        </nav>

        <div className={`p-4 border-t border-slate-800/80 bg-slate-950/70 ${!isExpanded ? 'text-center' : ''}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-indigo-500/20">
              TR
            </div>
            {isExpanded && (
              <div className="truncate">
                <div className="text-sm font-bold text-slate-100 truncate">Trainer Account</div>
                <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Active Now
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItem({ 
  href, 
  icon, 
  label, 
  isExpanded, 
  isActive, 
  onClick,
  accentColor = "from-indigo-600 to-purple-600"
}: { 
  href: string;
  icon: React.ReactNode;
  label: string;
  isExpanded: boolean;
  isActive: boolean;
  onClick?: () => void;
  accentColor?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center p-3 rounded-xl transition-all duration-200 group font-semibold text-sm ${
        isActive 
          ? `bg-gradient-to-r ${accentColor} text-white shadow-lg shadow-indigo-500/30 font-bold scale-[1.02]` 
          : 'text-slate-400 hover:bg-slate-800/70 hover:text-white hover:translate-x-1'
      }`}
      title={label}
    >
      <div className={`${!isExpanded && 'mx-auto'} ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400 transition-colors'}`}>
        {icon}
      </div>
      {isExpanded && (
        <span className="ml-3 tracking-wide">
          {label}
        </span>
      )}
    </Link>
  );
}
