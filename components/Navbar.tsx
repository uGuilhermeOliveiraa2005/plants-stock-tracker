"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, Clock, Bell } from "lucide-react"; // 1. IMPORTAR O SINO
import { useState } from "react"; // 2. IMPORTAR useState

// 3. IMPORTAR O NOVO MODAL
import NotificationModal from "./NotificationModal";

export default function Navbar() {
  const pathname = usePathname();
  // 4. STATE PARA CONTROLAR O MODAL
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <> {/* 5. Envolver com Fragment (<>) */}
      <nav className="navbar">
        <div className="nav-content">
          <Link href="/" className="nav-logo">
            PvB Tracker
          </Link>

          <div className="nav-controls"> {/* 6. Criar um wrapper para os links/botões */}
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

            {/* 7. BOTÃO DE NOTIFICAÇÃO */}
            <button
              className="nav-icon-btn"
              onClick={() => setIsModalOpen(true)}
              title="Configurar Notificações"
            >
              <Bell size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* 8. RENDERIZAR O MODAL (ele fica fora do <nav>) */}
      <NotificationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}