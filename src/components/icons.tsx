// Ícones de silhueta próprios (lucide não tem escavadeira/rolo).
// Desenhados em viewBox 64×64, perfil lateral, fiéis à anatomia real.
// Usam currentColor, então herdam a cor do texto.

// Escavadeira hidráulica de esteiras (estilo New Holland série E), vista de
// lado com a lança para a esquerda: esteira com roda motriz, roda guia e
// roletes; mesa giratória; cabine com vidro; casa de máquinas com contrapeso
// arredondado; lança "pescoço de ganso" com cilindro; braço com cilindro da
// caçamba; caçamba com dentes.
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
      {/* Esteira: banda com roda guia, roda motriz e roletes vazados */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M27 45H55A7 7 0 0 1 55 59H27A7 7 0 0 1 27 45ZM27 52m-3.4 0a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0-6.8 0ZM55 52m-3.4 0a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0-6.8 0ZM35 53.4m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0ZM41 53.4m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0ZM47 53.4m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0Z"
      />
      {/* Mesa giratória */}
      <path d="M31 41H51V46H31Z" />
      {/* Cabine (vidro vazado) + casa de máquinas + contrapeso */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M30 42V24A3 3 0 0 1 33 21H41A2 2 0 0 1 43 23V28H56C60.5 28 63 31 63 35.5V42ZM32.5 23.5H40.5V32H32.5Z"
      />
      {/* Lança: sobe reta, dobra arredondada no alto, desce até o braço */}
      <path d="M42.5 33.5L25 9.8C23.2 7.4 19.6 7 17.6 8.8L8 17.5L12 22L20 14.8C21 14 22.2 14.2 23 15.3L36.5 39.5Z" />
      {/* Cilindro da lança */}
      <path d="M30.5 40L26 25.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      {/* Braço com articulações */}
      <path d="M8 17.5L12 22L10.5 45.5L5.5 45Z" />
      <circle cx="10" cy="19.8" r="3.1" />
      <circle cx="8" cy="45.2" r="2.7" />
      {/* Cilindro da caçamba */}
      <path d="M13.2 26L12 41" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      {/* Caçamba com dentes */}
      <path d="M5 42H14.5V48C14.5 53.5 11.5 57.5 7 58.5L3 58.5C1.5 58.5 0.7 57.3 1 56L3 47.5ZM3 58.5L1.5 62.5L5.2 58.5ZM7 58.4L6.3 62.3L9.7 58ZM10.5 57L11.2 60.5L12.6 55.5Z" />
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
