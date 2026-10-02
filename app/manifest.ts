import type { MetadataRoute } from "next"

/** "Adicionar à tela inicial" no celular do motorista: abre como app, com o nome e o ícone do Escalador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Escalador",
    short_name: "Escalador",
    description: "Sistema de Alocação e Gestão de Frotas",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#ea7d01",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
