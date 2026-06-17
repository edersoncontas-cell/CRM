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
      {/* Silhueta vetorizada (potrace) a partir da foto de referência do Ederson.
          Enquadrada da bbox da imagem (x30-361, y42-319) para o viewBox 64. */}
      <g
        fillRule="evenodd"
        clipRule="evenodd"
        transform="translate(5 9.4) scale(0.16314) translate(-30 -42)"
      >
        <g transform="translate(0 360) scale(0.1 -0.1)">
          <path d="M2874 3161 c-129 -58 -138 -234 -16 -312 84 -53 188 -28 243 59 94 149 -65 327 -227 253z m131 -106 c16 -15 25 -36 25 -55 0 -19 -9 -40 -25 -55 -73 -73 -184 37 -113 112 30 32 81 31 113 -2z" />
          <path d="M2674 2949 c-16 -17 -164 -160 -329 -317 -165 -157 -339 -324 -387 -370 -73 -70 -91 -82 -103 -72 -10 8 -51 11 -134 8 l-121 -3 -32 -33 -33 -32 -3 -240 -3 -240 -160 0 -159 0 0 23 c0 13 -12 34 -26 48 -25 24 -29 24 -234 27 -241 4 -273 -3 -288 -60 l-8 -33 -85 -5 c-144 -8 -169 -41 -169 -224 0 -135 12 -175 62 -206 32 -20 48 -20 831 -20 722 0 802 2 827 16 58 35 60 45 60 362 l0 290 -25 16 c-14 9 -25 21 -25 27 0 6 116 132 258 281 141 149 308 325 370 392 62 67 119 122 126 124 7 2 25 -24 41 -60 40 -92 200 -447 253 -563 25 -55 56 -124 69 -153 l23 -53 43 44 c48 49 120 74 181 63 l34 -7 -27 68 c-16 37 -47 118 -71 178 -23 61 -57 148 -75 195 -19 47 -59 150 -90 230 -88 227 -90 233 -100 236 -6 2 -19 -11 -30 -28 -57 -90 -201 -121 -298 -65 -52 31 -85 71 -114 139 l-19 48 -30 -31z" />
          <path d="M3392 1913 c-119 -59 -109 -250 16 -288 18 -5 22 -13 22 -48 l0 -42 -98 -28 c-53 -16 -140 -41 -192 -57 -211 -65 -369 -110 -382 -110 -8 0 -24 20 -35 44 -24 49 -51 63 -84 46 -33 -18 -21 -71 50 -213 125 -254 301 -356 538 -312 265 49 374 203 327 466 -9 52 -18 128 -21 171 -5 76 -5 76 27 105 57 50 76 121 50 188 -30 78 -138 117 -218 78z m113 -99 c25 -25 16 -75 -17 -94 -32 -17 -54 -8 -77 32 -31 55 49 107 94 62z" />
          <path d="M537 1106 c-265 -109 -316 -448 -95 -629 97 -80 74 -78 869 -75 l704 3 59 29 c76 37 135 96 172 172 42 86 43 231 1 316 -39 80 -115 151 -194 183 l-63 25 -698 0 -697 0 -58 -24z m302 -204 c96 -71 95 -204 -1 -275 -120 -89 -298 48 -245 189 39 102 165 146 246 86z m535 6 c72 -32 104 -143 64 -218 -88 -164 -349 -76 -308 104 25 111 137 164 244 114z m518 12 c43 -12 93 -66 107 -114 37 -137 -119 -255 -243 -182 -171 100 -57 349 136 296z" />
        </g>
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
