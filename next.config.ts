import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indicador de dev (canto inferior esquerdo por padrão) sobrepõe o rodapé
  // da sidebar (avatar/sair/trocar senha), que fica nesse mesmo canto —
  // move pro canto oposto, onde não colide com nada.
  devIndicators: {
    position: "bottom-right",
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
