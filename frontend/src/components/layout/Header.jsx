import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, Plus, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { to: "/beds", label: "Beds" },
  { to: "/jobs", label: "Jobs" },
  { to: "/services", label: "Services" },
  { to: "/about", label: "About" },
];

export default function Header() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="sb-glass sticky top-0 z-50" data-testid="site-header">
      <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-12 h-[72px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" data-testid="logo-home-link">
          <div className="h-9 w-9 rounded-xl bg-[#C26D53] grid place-items-center text-white font-serif text-lg leading-none">sb</div>
          <span className="font-serif text-[1.35rem] tracking-tight text-[#2D3339]">SoberBoard</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({isActive}) => `text-[0.95rem] font-medium transition-colors ${isActive ? "text-[#C26D53]" : "text-[#2D3339] hover:text-[#C26D53]"}`}
              data-testid={`nav-${l.label.toLowerCase()}-link`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link to="/dashboard" className="sb-btn-outline inline-flex items-center gap-2" data-testid="header-dashboard-btn">
                <LayoutDashboard size={16} strokeWidth={1.6}/> Dashboard
              </Link>
              <Link to="/post" className="sb-btn-primary inline-flex items-center gap-2" data-testid="header-post-listing-btn">
                <Plus size={16} strokeWidth={2}/> Post a bed
              </Link>
              <button onClick={onLogout} className="text-[#5C6670] hover:text-[#C26D53] p-2" data-testid="header-logout-btn" aria-label="Logout">
                <LogOut size={18} strokeWidth={1.6}/>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-[#2D3339] hover:text-[#C26D53] font-medium" data-testid="header-login-link">Sign in</Link>
              <Link to="/post" className="sb-btn-primary inline-flex items-center gap-2" data-testid="header-post-listing-btn">
                <Plus size={16} strokeWidth={2}/> Post a bed
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden p-2 text-[#2D3339]" onClick={() => setOpen(!open)} data-testid="mobile-menu-toggle" aria-label="Menu">
          {open ? <X size={22}/> : <Menu size={22}/>}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[#EAE5D9] bg-[#FDFBF7]" data-testid="mobile-menu">
          <div className="px-5 py-4 flex flex-col gap-3">
            {links.map(l => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className="py-1.5 text-[#2D3339]" data-testid={`mobile-nav-${l.label.toLowerCase()}`}>{l.label}</NavLink>
            ))}
            <div className="sb-divider my-1"/>
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setOpen(false)} className="py-1.5">Dashboard</Link>
                <Link to="/post" onClick={() => setOpen(false)} className="py-1.5 text-[#C26D53] font-semibold">Post a bed</Link>
                <button onClick={() => { setOpen(false); onLogout(); }} className="py-1.5 text-left text-[#5C6670]">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="py-1.5">Sign in</Link>
                <Link to="/post" onClick={() => setOpen(false)} className="py-1.5 text-[#C26D53] font-semibold">Post a bed</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
