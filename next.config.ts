import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indicador de dev (canto inferior esquerdo por padrão) sobrepõe o rodapé
  // da sidebar (avatar/sair/trocar senha), que fica nesse mesmo canto —
  // move pro canto oposto, onde não colide com nada.
  devIndicators: {
    position: "bottom-right",
  },
  // Cabeçalhos de segurança em todas as respostas. CSP só com as diretivas
  // que não dependem de script (o Next usa script inline): não abrir dentro
  // de outro site (clickjacking), formulário só pro próprio domínio, sem
  // <object>/<embed> e sem trocar a base das URLs.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  // Relatórios renomeados — links e favoritos antigos continuam funcionando.
  async redirects() {
    return [
      { source: "/relatorios/sem-folga", destination: "/relatorios/estouro-7-dia", permanent: true },
      { source: "/relatorios/interjornada", destination: "/relatorios/quebra-intersticio", permanent: true },
      { source: "/relatorios/jornadas-longas", destination: "/relatorios/estouro-jornada", permanent: true },
      { source: "/relatorios/nao-consta", destination: "/relatorios", permanent: true },
    ];
  },
};

export default nextConfig;
