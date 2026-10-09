// The Soi Talk logo: a Bangkok street-name sign.
//   th / en  = the street name lines (Thai on top, English under)
//   number   = the soi number; in the brand this is the learner's street meter (%)
//   district = optional green plate underneath (used for topics)
//   gold     = gold frame for milestones and special cards
// Without a district plate, a small tab under the sign shows today's colour (--day).
export default function SoiSign({ th = 'ซอยทอล์ก', en = 'Soi Talk', number, district, gold = false, width = 260, title }) {
  const h = district ? 116 : 96;
  const frame = gold ? 'url(#soi-gold)' : '#0E2E63';
  return (
    <svg viewBox={`0 0 260 ${h}`} width={width} height={(width * h) / 260} role="img" aria-label={title || `${en}${number != null ? ` ${number}` : ''}`} className="soi-sign">
      <defs>
        <linearGradient id="soi-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A8741C" /><stop offset=".45" stopColor="#F3D27A" /><stop offset="1" stopColor="#B8862B" />
        </linearGradient>
      </defs>
      <path d="M14 2 H246 L258 43 L246 84 H14 L2 43 Z" fill={frame} />
      <path d="M18 7 H242 L253 43 L242 79 H18 L7 43 Z" fill="#1D4FA0" />
      <path d="M22 11 H238 L248 43 L238 75 H22 L12 43 Z" fill="none" stroke="#fff" strokeWidth="2.5" />
      <text x="32" y="44" fill="#fff" style={{ font: '700 27px var(--font-sign), sans-serif' }}>{th}</text>
      <text x="34" y="65" fill="#fff" style={{ font: '500 13px var(--font-sign), sans-serif', letterSpacing: '.04em' }}>{en}</text>
      {number != null && <text x="230" y="57" textAnchor="end" fill="#fff" style={{ font: '700 34px var(--font-sign), sans-serif' }}>{number}</text>}
      {district ? (
        <g>
          <rect x="60" y="86" width="140" height="26" rx="3" fill="#0B5E36" />
          <rect x="63" y="89" width="134" height="20" rx="2" fill="#1E8A4C" stroke="#fff" strokeWidth="1.5" />
          <text x="130" y="103" textAnchor="middle" fill="#fff" style={{ font: '500 11px var(--font-sign), sans-serif' }}>{district}</text>
        </g>
      ) : (
        <rect x="113" y="86" width="34" height="6" rx="3" style={{ fill: 'var(--day, #F2C200)' }} />
      )}
    </svg>
  );
}
