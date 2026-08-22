import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Indicador de dev (canto inferior esquerdo por padrão) sobrepõe o rodapé
  // da sidebar (avatar/sair/trocar senha), que fica nesse mesmo canto —
  // move pro canto oposto, onde não colide com nada.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
