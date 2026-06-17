// Ícones de silhueta próprios (lucide não tem escavadeira/rolo).
// Desenhados em viewBox 64 para boa leitura tanto pequenos (logo) quanto grandes.
// Usam currentColor, então herdam a cor do texto.

export function ExcavatorIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Esteira (undercarriage) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 46h26a6 6 0 0 1 0 12H11a6 6 0 0 1 0-12Zm2.5 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10.5 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10.5 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
      />
      {/* Plataforma giratória */}
      <rect x="13" y="41" width="24" height="5" rx="1.5" />
      {/* Cabine + casa (com janela vazada) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15 23h10l5 5v13H15a2 2 0 0 1-2-2V25a2 2 0 0 1 2-2Zm2 4v6h7v-6h-7Z"
      />
      {/* Lança + braço (boom + stick) */}
      <path d="M28.5 30.5 46 19.5l3.4 5.4-12.2 7.7 7.6 8.4-5 4.4-11.3-12.6a3 3 0 0 1 .0-2.7Z" />
      {/* Caçamba */}
      <path d="M37.5 40.5l9.5 3-1.6 7.2-9.4-3a3.4 3.4 0 0 1-1.3-4.9 3.4 3.4 0 0 1 2.8-2.3Z" />
    </svg>
  );
}

export function RollerIcon({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Tambor dianteiro (drum) — anel com cubo central */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18 26a16 16 0 1 0 0 32 16 16 0 0 0 0-32Zm0 5.5A10.5 10.5 0 1 1 18 52.5 10.5 10.5 0 0 1 18 31.5Z"
      />
      <circle cx="18" cy="42" r="3.4" />
      {/* Chassi / capô do motor */}
      <path d="M30 33h12a5 5 0 0 1 5 5v8H30a2 2 0 0 1-2-2V35a2 2 0 0 1 2-2Z" />
      {/* Cabine / estrutura ROPS */}
      <path d="M33 19h15a1.5 1.5 0 0 1 1.5 1.5V23H46v9h-3.5v-9H35.5v9H32v-9h-1.2a1.5 1.5 0 0 1 0-3H33v-1Z" />
      {/* Roda traseira */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M51 37a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm0 6a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
      />
    </svg>
  );
}
