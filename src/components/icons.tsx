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
      {/* Esteira (trilho de borracha/aço — retângulo com arredondamento oval) */}
      <rect x="4" y="50" width="56" height="13" rx="6" />

      {/* Roda guia dianteira e roda motriz traseira (recortes em negativo) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 50a6 6 0 0 0 0 13 6 6 0 0 0 0-13Zm0 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
        fill="black"
        fillOpacity="0.25"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M54 50a6 6 0 0 0 0 13 6 6 0 0 0 0-13Zm0 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
        fill="black"
        fillOpacity="0.25"
      />

      {/* Estructura inferior / carbody (une esteira à plataforma giratória) */}
      <rect x="10" y="42" width="44" height="10" rx="2" />

      {/* Cabine (cab) — lateral esquerda da plataforma, com janela vazada */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 42 L12 27 L32 27 L32 42 Z M14 29 L14 40 L30 40 L30 29 Z"
      />

      {/* Capô do motor + contrapeso (parte direita da plataforma) */}
      {/* Forma trapezoidal: capô mais baixo, contrapeso mais alto no extremo direito */}
      <path d="M32 42 L32 27 L46 25 L54 29 L56 42 Z" />

      {/* Lança / boom — viga diagonal subindo para cima-esquerda */}
      {/* Base na frente da cabine, ponta no alto à esquerda */}
      <path d="M17 34 L23 26 L15 4 L9 12 Z" />

      {/* Braço / stick — pendente da ponta da lança, vai para baixo-direita */}
      <path d="M9 12 L15 4 L24 18 L18 26 Z" />

      {/* Caçamba — formato em C na ponta do braço */}
      <path d="M18 26 L24 18 L32 26 Q35 37 24 40 L18 36 Q11 32 18 26 Z" />
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
