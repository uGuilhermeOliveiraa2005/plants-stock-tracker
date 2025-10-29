"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, Clock } from "lucide-react"; 

export default function Navbar() {
  const pathname = usePathname();

  return ( 
    // Comentários removidos daqui
    <nav className="navbar">
      <div className="nav-content">
        <Link href="/" className="nav-logo">
          PvB Tracker
        </Link>

        <div className="nav-links"> 
          <Link
            href="/"
            className={`nav-link ${pathname === "/" ? "active" : ""}`}
          >
            <Store size={18} />
            <span>Estoque</span>
          </Link>
          <Link
            href="/last-seen"
            className={`nav-link ${
              pathname === "/last-seen" ? "active" : ""
            }`}
          >
            <Clock size={18} />
            <span>Vistos por Último</span>
          </Link>
        </div>
        
      </div>
    </nav>
    // Comentários removidos daqui
  );
}