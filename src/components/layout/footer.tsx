import Link from "next/link";
import { SiteLogo } from "./site-logo";
export function Footer() {
  return <footer className="viewer-footer"><div className="viewer-container">
    <div className="footer-top"><SiteLogo /><p>Киноны қазақша көріңіз.</p><Link href="/premium">Premium</Link></div>
    <nav aria-label="Байланыс"><a href="mailto:info@hdqaz.online">Байланыс</a><a href="mailto:support@hdqaz.online">Қолдау</a><a href="mailto:admin@hdqaz.online">Әкімшілік</a><a href="https://t.me/hdqaz" target="_blank" rel="noreferrer">Telegram</a><a href="https://instagram.com/hdqaz" target="_blank" rel="noreferrer">Instagram</a></nav>
    <div className="footer-bottom"><p>© 2026 HdQaz</p><nav aria-label="Заңдық сілтемелер"><Link href="/terms">Пайдалану шарттары</Link><Link href="/privacy">Құпиялылық саясаты</Link><Link href="/dmca">DMCA / Авторлық құқық</Link></nav></div>
  </div></footer>;
}
