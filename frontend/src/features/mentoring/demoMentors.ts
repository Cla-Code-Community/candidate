import type { Mentor } from "@/features/mentoring/types";

export const initialMentors: Mentor[] = [
  {
    id: "mentor-1",
    name: "Julio Silva",
    rating: 3,
    completed: 33,
    days: "Seg, Qua, Sex",
    hours: "10:00 - 13:00",
    nextSessionDate: "Próxima mentoria: quarta-feira, 24 jul",
    specialty: "Frontend React, Design de Componentes e Otimização de Performance",
    avatarColor: "from-teal-500 to-emerald-600",
    platform: "Google Meet",
    platformUrl: "https://meet.google.com/react-mentor-demo",
    agenda:
      "Revisão de componentes React, organização de estados, renderização eficiente e próximos passos para um portfólio frontend mais forte.",
  },
  {
    id: "mentor-2",
    name: "Silvia Maria",
    rating: 4,
    completed: 103,
    days: "Seg, Ter, Qua, Sex",
    hours: "10:00 - 13:00",
    nextSessionDate: "Próxima mentoria: terça-feira, 23 jul",
    specialty: "Arquitetura Fullstack, Bancos de Dados Relacionais e APIs seguras",
    avatarColor: "from-blue-500 to-indigo-600",
    platform: "Zoom",
    platformUrl: "https://zoom.us/j/1234567890",
    agenda:
      "Mapeamento de arquitetura fullstack, desenho de APIs, decisões de banco de dados e checklist de segurança para aplicações em produção.",
  },
  {
    id: "mentor-3",
    name: "Bia Costa",
    rating: 1,
    completed: 3,
    days: "Seg, Qua, Sex",
    hours: "10:00 - 13:00",
    nextSessionDate: "Próxima mentoria: sexta-feira, 26 jul",
    specialty: "Design de Produto, Figma Avançado, Prototipação e Testes com Usuários",
    avatarColor: "from-pink-500 to-purple-600",
    platform: "Discord",
    platformUrl: "https://discord.gg/product-design-demo",
    agenda:
      "Análise de fluxo de produto, refinamento de protótipos no Figma, narrativa de case e preparação para entrevistas de UX/UI.",
  },
];
