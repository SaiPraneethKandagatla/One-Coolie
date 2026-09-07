import { Heart, Headphones } from 'lucide-react';
import { Link } from 'react-router-dom';
import oneCoolieLogo from '../assets/onecoolie-logo.png';

/* ============================================================
   ONECOOLIE GLOBAL FOOTER
   Clean corporate footer with Movesphere Technologies attribution
   ============================================================ */

export default function Footer({ className = '' }) {
    return (
        <footer className={`w-full bg-white border-t border-slate-200/80 py-4 px-4 sm:px-8 lg:px-12 mt-auto z-10 transition-all ${className}`}>
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-zinc-500 font-medium">
                <div className="flex items-center gap-2">
                    <img src={oneCoolieLogo} alt="OneCoolie" className="h-6 sm:h-7 w-auto object-contain" />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-center text-xs text-zinc-500">
                    <span>© 2026 OneCoolie. All rights reserved.</span>
                    <span className="text-slate-300">•</span>
                    <span>Under Movesphere Technologies</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <Link to="/support" className="flex items-center gap-1.5 hover:text-blue-600 transition-colors font-bold">
                        <Headphones className="w-3.5 h-3.5" />
                        Help & Support
                    </Link>
                    <div className="flex items-center gap-1.5">
                        <span>Made with</span>
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                        <span>in India</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
