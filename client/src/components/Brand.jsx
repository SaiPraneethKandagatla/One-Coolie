import { Link } from 'react-router-dom';
import oneCoolieLogo from '../assets/onecoolie-logo.png';

/* ============================================================
   BRAND COMPONENT — Official OneCoolie Logo
   Renders the authentic OneCoolie logo on both dark & light surfaces
   ============================================================ */

export default function Brand({ sub, dark = false, className = '' }) {
  const logoSrc = oneCoolieLogo;

  return (
    <Link to="/" className={`inline-flex items-center gap-3 group select-none ${className}`}>
      {/* Official OneCoolie Logo */}
      <img
        src={logoSrc}
        alt="OneCoolie — Your Journey, Our Support"
        className="h-8 sm:h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
      />

      {sub && (
        <span
          className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${dark
            ? 'bg-zinc-900 text-zinc-300 border border-zinc-800'
            : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
            }`}
        >
          {sub}
        </span>
      )}
    </Link>
  );
}