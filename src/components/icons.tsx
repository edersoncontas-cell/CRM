// Ícones de silhueta próprios (lucide não tem escavadeira/rolo).
// Perfil lateral, fiéis à anatomia real. Usam currentColor, então herdam a
// cor do texto.

// Escavadeira hidráulica de esteiras vista de lado (referência enviada pelo
// Ederson): lança erguida para a direita, braço descendo, caçamba cheia,
// cabine com janela, capô com filtro de ar e escapamento, esteira. Desenho em
// 560×560; as mesmas peças servem ao ícone monocromático e ao logo colorido.
function PecasEscavadeira() {
  return (
    <>
      {/* Esteira */}
      <path d="M140 353L285 344A24 24 0 0 1 285 392L140 397A22 22 0 0 1 140 353Z" />
      {/* Casa de máquinas + contrapeso + cabine (moldura da janela e corrimão vazados) */}
      <path fillRule="evenodd" clipRule="evenodd" d="M92 350V310C92 300 98 296 108 296H205V278C205 271 210 266 217 266H282C288 266 292 270 292 276V350ZM214 278H284V322H214ZM217 281V319H281V281ZM166 296V272C166 268 169 266 173 266H198V296H195V269H169V296Z" />
      {/* Capô: filtro de ar e escapamento */}
      <path d="M97 296V284C97 281 99 280 102 280H114V296ZM122 296V288H150V296Z" />
      {/* Lança */}
      <path d="M218 296L354 140A20 20 0 0 1 392 165L268 300Z" />
      {/* Cilindro da lança e cilindro do braço (com fresta) */}
      <path d="M293 284L348 224" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <path d="M287 205L342 145" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      {/* Braço */}
      <path d="M372 152L450 255" fill="none" stroke="currentColor" strokeWidth="34" strokeLinecap="round" />
      {/* Cilindro da caçamba + articulação */}
      <path d="M407 157L447 209" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <path d="M447 209L458 240" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      {/* Caçamba com dentes */}
      <path d="M428 246L465 250C486 262 490 300 478 328C468 350 448 360 425 358L392 350C400 332 412 306 428 292ZM400 338L372 352L402 360ZM412 358L392 372L420 360Z" />
    </>
  );
}

// Ícone monocromático (herda a cor do texto). Enquadrado na escavadeira.
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
      viewBox="68 43 440 440"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <PecasEscavadeira />
    </svg>
  );
}

// Contorno do monte de terra do logo (gerado uma vez, fixo).
const MONTE = "M0 560 L0 386.1 Q0 386.1 7.0 387.0 Q14 387.8 21.0 382.6 Q28 377.4 35.0 375.1 Q42 372.9 49.0 372.8 Q56 372.7 63.0 377.1 Q70 381.6 77.0 379.1 Q84 376.5 91.0 378.9 Q98 381.2 105.0 385.9 Q112 390.6 119.0 388.2 Q126 385.8 133.0 387.9 Q140 389.9 147.0 391.5 Q154 393.2 161.0 394.0 Q168 394.9 175.0 391.9 Q182 389 189.0 387.5 Q196 386 203.0 387.1 Q210 388.3 217.0 388.4 Q224 388.4 231.0 389.4 Q238 390.5 245.0 388.3 Q252 386.1 259.0 390.1 Q266 394 273.0 389.2 Q280 384.4 287.0 389.1 Q294 393.9 301.0 389.5 Q308 385.1 315.0 388.5 Q322 391.8 329.0 394.1 Q336 396.4 343.0 399.0 Q350 401.6 357.0 404.1 Q364 406.5 371.0 409.1 Q378 411.6 385.0 414.3 Q392 416.9 399.0 416.8 Q406 416.6 413.0 422.6 Q420 428.7 427.0 425.9 Q434 423.1 441.0 426.1 Q448 429.1 455.0 434.2 Q462 439.3 469.0 444.6 Q476 449.9 483.0 446.5 Q490 443.2 497.0 450.1 Q504 457.1 511.0 458.2 Q518 459.3 525.0 462.6 Q532 466 539.0 464.4 Q546 462.7 553.0 467.2 L560 471.7 L560 560 Z";

export const LOGO_AMARELO = "#ffcb2d";

// Logo do CRM: escavadeira amarela sobre o monte de terra preto, fundo
// branco — exatamente a cena escolhida pelo Ederson. `recorte` enquadra mais
// perto da máquina (bom para caixas pequenas: menu, login); sem recorte é a
// cena completa (splash, ícone do app).
export function LogoEscavadeira({
  size = 40,
  className,
  recorte = true,
}: {
  size?: number;
  className?: string;
  recorte?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={recorte ? "60 120 460 460" : "0 0 560 560"}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <rect width="560" height="560" fill="#ffffff" />
      <path d={MONTE} fill="#000000" />
      <g fill={LOGO_AMARELO} color={LOGO_AMARELO}>
        <PecasEscavadeira />
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
