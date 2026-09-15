// Ícones de silhueta próprios (lucide não tem escavadeira/rolo).
// Perfil lateral, fiéis à anatomia real. Usam currentColor, então herdam a
// cor do texto.

// Escavadeira hidráulica de esteiras (estilo New Holland série E), vista de
// lado com a lança para a esquerda, na pose clássica: lança erguida, braço
// caído e caçamba apoiada no chão. Desenho em 640×640 (mais precisão nas
// curvas) — lança, braço e cilindros são traços grossos com pontas redondas,
// o que mantém a silhueta limpa em qualquer tamanho.
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
      viewBox="0 0 640 640"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <g transform="translate(0 -18)">
        {/* Esteira: banda, roda guia, roda motriz, quadro e roletes */}
        <path fillRule="evenodd" clipRule="evenodd" d="M262 482H572A59 59 0 0 1 572 600H262A59 59 0 0 1 262 482ZM262 506A35 35 0 0 0 262 576H572A35 35 0 0 0 572 506Z" />
        <path d="M262 514a27 27 0 1 0 .1 0ZM572 514a27 27 0 1 0 .1 0ZM258 533H576V550H258Z" />
        <path d="M330 551a12 12 0 1 0 .1 0ZM386 551a12 12 0 1 0 .1 0ZM442 551a12 12 0 1 0 .1 0ZM498 551a12 12 0 1 0 .1 0Z" />
        {/* Mesa giratória */}
        <path d="M340 452H530V488H340Z" />
        {/* Cabine (vidro vazado) + capô + contrapeso arredondado */}
        <path fillRule="evenodd" clipRule="evenodd" d="M302 458V346C302 312 322 300 348 300H400C410 300 416 308 416 320V352H558C608 352 640 382 640 430V480H302ZM318 332C318 322 324 316 334 316H380C388 316 392 320 392 328V412H318Z" />
        {/* Cilindro da lança, entre a frente da cabine e a lança */}
        <path d="M318 472L262 332" fill="none" stroke="currentColor" strokeWidth="30" strokeLinecap="round" />
        {/* Lança em peça única, cotovelo arredondado */}
        <path d="M365 425L225 205L118 152" fill="none" stroke="currentColor" strokeWidth="70" strokeLinecap="round" strokeLinejoin="round" />
        {/* Braço */}
        <path d="M121 142L75 470" fill="none" stroke="currentColor" strokeWidth="52" strokeLinecap="round" />
        {/* Cilindro da caçamba e articulação */}
        <path d="M158 222L138 372" fill="none" stroke="currentColor" strokeWidth="26" strokeLinecap="round" />
        <path d="M138 372L96 440" fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
        {/* Caçamba apoiada no chão, lábio inclinado e dentes para a frente */}
        <path d="M62 462H106C150 462 170 520 150 570C138 598 116 606 90 606H40C32 606 27 600 28 592C34 546 46 500 62 462ZM29 590L-2 608L38 606ZM48 606L42 626L72 606Z" />
      </g>
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
