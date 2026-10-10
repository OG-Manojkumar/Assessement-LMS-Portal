"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();

  const toggleSidebar = () => setIsExpanded(!isExpanded);

  return (
    <aside 
      className={`${isExpanded ? 'w-64' : 'w-20'} bg-slate-900 flex flex-col transition-all duration-300 relative z-20 text-slate-300 shadow-xl`}
    >
      <div className={`p-6 border-b border-slate-800 flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} h-24`}>
        {isExpanded && (
          <h1 className="text-lg font-black text-white leading-tight truncate tracking-tight">
            Besant Tech<br/><span className="text-indigo-400 text-xs tracking-widest uppercase font-bold">Mock Exams</span>
          </h1>
        )}
        <button 
          onClick={toggleSidebar} 
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors focus:outline-none"
        >
          {isExpanded ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 mt-4">
        <NavItem 
          href="/trainer" 
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} 
          label="Dashboard" 
          isExpanded={isExpanded} 
          isActive={pathname === '/trainer'}
        />
        <NavItem 
          href="/trainer/question-bank" 
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>} 
          label="Question Bank" 
          isExpanded={isExpanded} 
          isActive={pathname.includes('/question-bank')}
        />
        <NavItem 
          href="/trainer/assessments" 
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} 
          label="Assessments" 
          isExpanded={isExpanded} 
          isActive={pathname.includes('/assessments')}
        />
      </nav>

      <div className={`p-4 border-t border-slate-800 bg-slate-900/50 ${!isExpanded && 'text-center'}`}>
        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold mx-auto ring-1 ring-indigo-500/30">
          TR
        </div>
        {isExpanded && (
          <div className="mt-3 text-center">
            <div className="text-sm font-semibold text-slate-200">Trainer Account</div>
            <div className="text-xs text-slate-500 font-medium">Active session</div>
          </div>
        )}
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, isExpanded, isActive }: { href: string, icon: React.ReactNode, label: string, isExpanded: boolean, isActive: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center p-3 rounded-xl transition-all duration-200 group font-medium text-sm
        ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
      title={label}
    >
      <div className={`${!isExpanded && 'mx-auto'} ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`}>
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
