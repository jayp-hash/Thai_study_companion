'use client';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/vocabulary', label: 'Vocabulary' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <a href="/" className="brand">
        <span className="th">ภ</span>Thai Study Companion
      </a>
      <nav>
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={pathname === link.href ? 'active' : ''}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
