// Ícones de silhueta próprios (lucide não tem escavadeira/rolo).
// Desenhados em viewBox 64×64, perfil lateral esquerdo fiel à anatomia real.
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
      {/* Esteira (track) — formato pílula com 3 rodas vazadas */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 47h24a8 8 0 0 1 0 16H12a8 8 0 0 1 0-16Zm2 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm10 0a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm10 0a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
      />
      {/* Casa / cabine em degrau, sobre a esteira */}
      <path d="M6 46V33a2 2 0 0 1 2-2h4v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5h11v15H6Z" />
      {/* Lança (boom) — barra diagonal grossa subindo para a direita */}
      <path d="M28 33.5 35.5 41 56 21l-7.5-7.5L28 33.5Z" />
      {/* Polia no topo da lança (círculo com furo) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M52.5 11a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
      />
      {/* Braço (stick) descendo da polia até a caçamba */}
      <path d="M49 19.5 55.5 26 52 37l-7-3.5L49 19.5Z" />
      {/* Caçamba (bucket) — concha curva na ponta */}
      <path d="M44 32q-3 12 8 13l5.5-5q1-8-7-11Z" />
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
